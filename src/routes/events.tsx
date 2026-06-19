import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { AlertTriangle, KeyRound, LogIn, Power, ShieldAlert, Usb } from "lucide-react";
import { eventTypeLabel, relTime, severityClass } from "@/lib/soc-format";

export const Route = createFileRoute("/events")({
  head: () => ({ meta: [{ title: "Event Timeline — SentinelX" }, { name: "description", content: "Live timeline of security events, USB activity and login telemetry from your endpoints." }] }),
  component: Events,
});

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  failed_login: KeyRound,
  login_success: LogIn,
  usb_inserted: Usb,
  usb_removed: Usb,
  system_startup: Power,
  system_shutdown: Power,
  security_alert: ShieldAlert,
};

function Events() {
  const [filter, setFilter] = useState<string>("all");

  const { data } = useQuery({
    queryKey: ["events-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("endpoint_events").select("*").order("occurred_at", { ascending: false }).limit(500);
      if (error) throw error; return data ?? [];
    },
  });

  const filters = ["all","critical","high","medium","info"];
  const rows = useMemo(() => {
    if (filter === "all") return data ?? [];
    return (data ?? []).filter(e => e.severity === filter);
  }, [data, filter]);

  return (
    <div className="p-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-[0.2em] text-cyan text-glow">// telemetry feed</div>
          <h1 className="text-3xl font-bold mt-1 tracking-tight">Event Timeline</h1>
          <p className="text-sm text-muted-foreground mt-1">{rows.length} events</p>
        </div>
        <div className="flex panel p-1">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs uppercase font-mono tracking-wider rounded ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >{f}</button>
          ))}
        </div>
      </header>

      <div className="panel p-2">
        <div className="relative">
          <div className="absolute left-[31px] top-0 bottom-0 w-px bg-[var(--panel-border)]" />
          {rows.map(ev => {
            const Icon = TYPE_ICONS[ev.event_type] ?? AlertTriangle;
            return (
              <div key={ev.id} className="relative pl-16 pr-4 py-3 hover:bg-accent/30 rounded transition-colors">
                <div className="absolute left-4 top-4 w-6 h-6 rounded-full border border-[var(--panel-border)] bg-card grid place-items-center">
                  <Icon className="w-3 h-3 text-cyan" />
                </div>
                <div className="flex items-start gap-3 flex-wrap">
                  <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border font-mono text-[10px] uppercase tracking-wider ${severityClass(ev.severity)}`}>
                    {ev.severity}
                  </div>
                  <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    {eventTypeLabel[ev.event_type] ?? ev.event_type}
                  </div>
                  <div className="ml-auto font-mono text-[11px] text-muted-foreground">{relTime(ev.occurred_at)}</div>
                </div>
                <div className="mt-1.5 text-sm font-medium">{ev.title}</div>
                <div className="text-xs text-muted-foreground mt-1 font-mono">{ev.description}</div>
                <div className="text-[10px] text-muted-foreground/70 mt-1 font-mono">agent={ev.agent_id}</div>
              </div>
            );
          })}
          {rows.length === 0 && (
            <div className="py-12 text-center text-muted-foreground font-mono text-sm">No events match this severity filter.</div>
          )}
        </div>
      </div>
    </div>
  );
}
