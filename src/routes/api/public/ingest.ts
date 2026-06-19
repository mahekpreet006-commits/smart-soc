import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Agent-Key",
  "Access-Control-Max-Age": "86400",
} as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

type IngestPayload = {
  agent_id: string;
  hostname: string;
  username?: string;
  os_version?: string;
  ip_address?: string;
  agent_version?: string;
  events?: Array<{
    event_type: string;
    severity?: "info" | "medium" | "high" | "critical";
    title: string;
    description?: string;
    occurred_at?: string;
    raw?: Record<string, unknown>;
  }>;
};

const SEV_WEIGHTS: Record<string, number> = { info: 1, medium: 4, high: 9, critical: 18 };

export const Route = createFileRoute("/api/public/ingest")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const key = request.headers.get("x-agent-key");
          const expected = process.env.AGENT_API_KEY;
          if (!expected) return json({ error: "Server not configured" }, 500);
          if (!key || key !== expected) return json({ error: "Unauthorized" }, 401);

          const body = (await request.json()) as IngestPayload;
          if (!body?.agent_id || !body?.hostname) {
            return json({ error: "Missing agent_id or hostname" }, 400);
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Upsert endpoint
          const events = Array.isArray(body.events) ? body.events : [];
          const riskDelta = events.reduce((acc, e) => acc + (SEV_WEIGHTS[e.severity ?? "info"] ?? 1), 0);

          const { data: existing } = await supabaseAdmin
            .from("endpoints")
            .select("id, risk_score")
            .eq("agent_id", body.agent_id)
            .maybeSingle();

          let endpointId: string;
          if (existing) {
            const newRisk = Math.min(100, Math.max(0, Math.round(existing.risk_score * 0.9 + riskDelta)));
            const { error } = await supabaseAdmin
              .from("endpoints")
              .update({
                hostname: body.hostname,
                username: body.username ?? null,
                os_version: body.os_version ?? null,
                ip_address: body.ip_address ?? null,
                agent_version: body.agent_version ?? null,
                status: "online",
                last_seen: new Date().toISOString(),
                risk_score: newRisk,
              })
              .eq("id", existing.id);
            if (error) return json({ error: error.message }, 500);
            endpointId = existing.id;
          } else {
            const { data, error } = await supabaseAdmin
              .from("endpoints")
              .insert({
                agent_id: body.agent_id,
                hostname: body.hostname,
                username: body.username ?? null,
                os_version: body.os_version ?? null,
                ip_address: body.ip_address ?? null,
                agent_version: body.agent_version ?? null,
                status: "online",
                risk_score: Math.min(100, riskDelta),
              })
              .select("id")
              .single();
            if (error || !data) return json({ error: error?.message ?? "Insert failed" }, 500);
            endpointId = data.id;
          }

          // Insert events
          if (events.length > 0) {
            const rows = events.map((e) => ({
              endpoint_id: endpointId,
              agent_id: body.agent_id,
              event_type: e.event_type,
              severity: e.severity ?? "info",
              title: e.title,
              description: e.description ?? null,
              raw: e.raw ?? {},
              occurred_at: e.occurred_at ?? new Date().toISOString(),
            }));
            const { error } = await supabaseAdmin.from("endpoint_events").insert(rows);
            if (error) return json({ error: error.message }, 500);
          }

          return json({ ok: true, endpoint_id: endpointId, events_ingested: events.length });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          return json({ error: msg }, 500);
        }
      },
    },
  },
});
