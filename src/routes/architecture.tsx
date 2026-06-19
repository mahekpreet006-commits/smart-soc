import { createFileRoute } from "@tanstack/react-router";
import { Activity, Database, KeyRound, Lock, MonitorSmartphone, ShieldCheck, Wifi, Cpu, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/architecture")({
  head: () => ({
    meta: [
      { title: "Architecture — SentinelX SOC" },
      { name: "description", content: "End-to-end architecture of the SentinelX SOC: Windows endpoint agents, secure ingest API, Postgres telemetry store and the operations dashboard." },
    ],
  }),
  component: Arch,
});

function Arch() {
  return (
    <div className="p-8 space-y-8">
      <header>
        <div className="text-xs font-mono uppercase tracking-[0.2em] text-cyan text-glow">// system topology</div>
        <h1 className="text-3xl font-bold mt-1 tracking-tight">Architecture & Data Flow</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          How security telemetry travels from Windows endpoints through the secure ingest API into the Postgres telemetry store and onto the analyst dashboard.
        </p>
      </header>

      <div className="panel p-8 overflow-x-auto">
        <div className="min-w-[980px] grid grid-cols-4 gap-6 items-stretch">
          <Stage
            title="Windows Endpoints"
            subtitle="Python Agent · v1.0"
            icon={MonitorSmartphone}
            accent="cyan"
            lines={["WinEvent log subscription", "WMI USB hooks", "Heartbeat 5m", "Local cache + retry"]}
          />
          <Stage
            title="Secure Transport"
            subtitle="HTTPS · HMAC · API Key"
            icon={Lock}
            accent="primary"
            lines={["TLS 1.2+", "X-Agent-Key header", "Schema-validated JSON", "Rate limited"]}
          />
          <Stage
            title="Ingest API"
            subtitle="/api/public/ingest"
            icon={Cpu}
            accent="warning"
            lines={["TanStack server route", "Validates payloads", "Upserts endpoint", "Bulk inserts events"]}
          />
          <Stage
            title="SOC Dashboard"
            subtitle="Analyst Console"
            icon={ShieldCheck}
            accent="success"
            lines={["Live timeline", "Risk scoring", "Search & filter", "Analytics rollups"]}
          />

          {/* Arrows row */}
          {[0,1,2].map(i => (
            <div key={i} className="col-start-auto" style={{ gridColumn: i + 1 }} />
          ))}
        </div>

        {/* Connector strip */}
        <div className="min-w-[980px] grid grid-cols-4 gap-6 mt-4">
          {[0,1,2,3].map(i => (
            <div key={i} className="flex items-center justify-end pr-0">
              {i < 3 && (
                <div className="flex items-center gap-2 -mr-12 font-mono text-[10px] uppercase tracking-widest text-cyan">
                  <div className="h-px w-20 bg-gradient-to-r from-cyan to-transparent" />
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 panel p-5 bg-[oklch(0.18_0.03_252)]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Layer
              icon={Database}
              title="Persistence"
              text="PostgreSQL via Lovable Cloud. RLS-locked tables, append-only event log, indexes on (occurred_at, severity, endpoint_id)."
            />
            <Layer
              icon={Activity}
              title="Analytics"
              text="Risk scoring, most-active endpoints, failed-login + USB stats and trend bucketing computed on read."
            />
            <Layer
              icon={KeyRound}
              title="Security"
              text="Shared AGENT_API_KEY in HMAC mode, anonymous writes disabled at the DB, server route is the only ingestion path."
            />
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="panel p-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest font-mono text-muted-foreground">Telemetry Sources</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {[
              ["Security log", "4624 / 4625 logon + failure events"],
              ["System log", "Startup, shutdown, service install"],
              ["Application log", "Defender, Sysmon hooks"],
              ["WMI USB", "Win32_VolumeChangeEvent / PnP insert/remove"],
              ["Heartbeat", "Host info + presence ping every 5m"],
            ].map(([k, v]) => (
              <li key={k} className="flex gap-3">
                <span className="font-mono text-cyan w-28 shrink-0">{k}</span>
                <span className="text-muted-foreground">{v}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel p-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest font-mono text-muted-foreground">Resilience</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {[
              ["Offline buffer", "SQLite spool replays on reconnect"],
              ["Backoff", "Exponential with jitter, max 5m"],
              ["Idempotency", "agent_id+occurred_at de-dupes"],
              ["Updates", "Self-update channel via signed manifest"],
              ["Footprint", "<25 MB RAM, <1% CPU steady-state"],
            ].map(([k, v]) => (
              <li key={k} className="flex gap-3">
                <span className="font-mono text-cyan w-28 shrink-0">{k}</span>
                <span className="text-muted-foreground">{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Stage({
  title, subtitle, icon: Icon, accent, lines,
}: { title: string; subtitle: string; icon: any; accent: "cyan"|"primary"|"warning"|"success"; lines: string[] }) {
  const colors = {
    cyan: "text-cyan border-cyan/40",
    primary: "text-primary border-primary/40",
    warning: "text-warning border-warning/40",
    success: "text-success border-success/40",
  }[accent];
  return (
    <div className="panel p-5 relative overflow-hidden h-full">
      <div className={`w-12 h-12 rounded-md border ${colors} grid place-items-center bg-card`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="mt-4 font-bold tracking-tight">{title}</div>
      <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mt-0.5">{subtitle}</div>
      <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground font-mono">
        {lines.map(l => <li key={l} className="flex gap-2"><span className="text-cyan">›</span> {l}</li>)}
      </ul>
      <Wifi className="absolute -bottom-3 -right-3 w-24 h-24 text-foreground/5" />
    </div>
  );
}

function Layer({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-9 h-9 rounded bg-accent grid place-items-center shrink-0">
        <Icon className="w-4 h-4 text-cyan" />
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{text}</div>
      </div>
    </div>
  );
}
