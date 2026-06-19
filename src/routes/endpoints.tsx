import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Search, MonitorSmartphone } from "lucide-react";
import { relTime, riskClass, riskBar } from "@/lib/soc-format";

export const Route = createFileRoute("/endpoints")({
  head: () => ({ meta: [{ title: "Endpoint Inventory — SentinelX" }, { name: "description", content: "Manage and search your Windows endpoint inventory, risk and online status." }] }),
  component: Endpoints,
});

function Endpoints() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all"|"online"|"offline">("all");

  const { data } = useQuery({
    queryKey: ["endpoints-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("endpoints").select("*").order("last_seen", { ascending: false });
      if (error) throw error; return data ?? [];
    },
  });

  const rows = useMemo(() => {
    let r = data ?? [];
    if (status !== "all") r = r.filter(x => x.status === status);
    if (q.trim()) {
      const t = q.toLowerCase();
      r = r.filter(x =>
        x.hostname.toLowerCase().includes(t) ||
        (x.username ?? "").toLowerCase().includes(t) ||
        (x.ip_address ?? "").toLowerCase().includes(t) ||
        x.agent_id.toLowerCase().includes(t)
      );
    }
    return r;
  }, [data, q, status]);

  return (
    <div className="p-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-[0.2em] text-cyan text-glow">// inventory</div>
          <h1 className="text-3xl font-bold mt-1 tracking-tight">Endpoint Management</h1>
          <p className="text-sm text-muted-foreground mt-1">{rows.length} of {data?.length ?? 0} endpoints</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search host, user, IP…"
              className="pl-9 pr-3 py-2 bg-input border border-border rounded-md font-mono text-sm w-72 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex panel p-1">
            {(["all","online","offline"] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`px-3 py-1.5 text-xs uppercase font-mono tracking-wider rounded ${status === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >{s}</button>
            ))}
          </div>
        </div>
      </header>

      <div className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[oklch(0.24_0.03_252)] text-[11px] uppercase tracking-widest font-mono text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Endpoint</th>
              <th className="text-left px-4 py-3">User</th>
              <th className="text-left px-4 py-3">OS</th>
              <th className="text-left px-4 py-3">IP Address</th>
              <th className="text-left px-4 py-3">Risk</th>
              <th className="text-left px-4 py-3">Last Seen</th>
              <th className="text-left px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--panel-border)]">
            {rows.map(e => (
              <tr key={e.id} className="hover:bg-accent/40 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-accent grid place-items-center">
                      <MonitorSmartphone className="w-4 h-4 text-cyan" />
                    </div>
                    <div>
                      <div className="font-mono font-semibold">{e.hostname}</div>
                      <div className="text-[11px] font-mono text-muted-foreground">{e.agent_id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono">{e.username ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{e.os_version ?? "—"}</td>
                <td className="px-4 py-3 font-mono">{e.ip_address ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 w-40">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full ${riskBar(e.risk_score)}`} style={{ width: `${Math.min(100, e.risk_score)}%` }} />
                    </div>
                    <span className={`font-mono font-bold ${riskClass(e.risk_score)}`}>{e.risk_score}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{relTime(e.last_seen)}</td>
                <td className="px-4 py-3">
                  <div className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
                    <span className={`w-2 h-2 rounded-full ${e.status === "online" ? "bg-success" : "bg-muted-foreground"}`} />
                    {e.status}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground font-mono text-sm">No endpoints match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
