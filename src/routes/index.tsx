import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Activity, AlertTriangle, ShieldAlert, Usb, KeyRound, MonitorSmartphone, ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { relTime, severityClass, eventTypeLabel, riskClass } from "@/lib/soc-format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SOC Overview — SentinelX" },
      { name: "description", content: "Realtime SOC overview: online endpoints, active threats and security telemetry trends." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const endpoints = useQuery({
    queryKey: ["endpoints"],
    queryFn: async () => {
      const { data, error } = await supabase.from("endpoints").select("*").order("risk_score", { ascending: false });
      if (error) throw error; return data ?? [];
    },
  });
  const events = useQuery({
    queryKey: ["events", 200],
    queryFn: async () => {
      const { data, error } = await supabase.from("endpoint_events").select("*").order("occurred_at", { ascending: false }).limit(200);
      if (error) throw error; return data ?? [];
    },
  });

  const eps = endpoints.data ?? [];
  const evs = events.data ?? [];
  const online = eps.filter(e => e.status === "online").length;
  const critical = evs.filter(e => e.severity === "critical").length;
  const failedLogins = evs.filter(e => e.event_type === "failed_login").length;
  const usbCount = evs.filter(e => e.event_type === "usb_inserted" || e.event_type === "usb_removed").length;

  const byType = ["failed_login","usb_inserted","security_alert","login_success","system_startup","usb_removed"].map(t => ({
    type: eventTypeLabel[t] ?? t,
    count: evs.filter(e => e.event_type === t).length,
  }));
  const sevDist = ["critical","high","medium","info"].map(s => ({
    name: s, value: evs.filter(e => e.severity === s).length,
  }));
  const sevColors = ["var(--destructive)","var(--warning)","var(--cyan)","var(--muted-foreground)"];
  const topRisky = eps.slice(0, 5);

  // 24h trend (bucket by hour)
  const now = Date.now();
  const trend = Array.from({ length: 12 }).map((_, i) => {
    const start = now - (11 - i) * 60 * 60 * 1000;
    const end = start + 60 * 60 * 1000;
    const c = evs.filter(e => {
      const t = new Date(e.occurred_at).getTime();
      return t >= start && t < end;
    }).length;
    const d = new Date(start);
    return { hour: `${String(d.getHours()).padStart(2,"0")}:00`, events: c };
  });

  return (
    <div className="p-8 space-y-8">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-[0.2em] text-cyan text-glow">// command center</div>
          <h1 className="text-3xl font-bold mt-1 tracking-tight">Security Operations Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">Realtime telemetry from Windows endpoints — last 24 hours.</p>
        </div>
        <div className="flex items-center gap-2 panel px-4 py-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 pulse-dot-inner" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
          </span>
          <span className="font-mono text-xs uppercase tracking-wider">All Systems Operational</span>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi label="Online Endpoints" value={`${online}/${eps.length}`} icon={MonitorSmartphone} accent="success" hint={`${eps.length - online} offline`} />
        <Kpi label="Critical Alerts" value={critical} icon={ShieldAlert} accent="danger" hint="Last 24h" />
        <Kpi label="Failed Logins" value={failedLogins} icon={KeyRound} accent="warning" hint="Across fleet" />
        <Kpi label="USB Activity" value={usbCount} icon={Usb} accent="cyan" hint="Insert / remove" />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="panel p-5 xl:col-span-2">
          <ChartHeader title="Event Velocity" subtitle="Events per hour · last 12h" />
          <div className="h-64 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
                <XAxis dataKey="hour" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="events" stroke="var(--primary)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-5">
          <ChartHeader title="Severity Mix" subtitle="Open events" />
          <div className="h-64 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sevDist} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="var(--background)" strokeWidth={2}>
                  {sevDist.map((_, i) => <Cell key={i} fill={sevColors[i]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
            {sevDist.map((s, i) => (
              <div key={s.name} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-sm" style={{ background: sevColors[i] }} />
                <span className="uppercase font-mono tracking-wider text-muted-foreground">{s.name}</span>
                <span className="ml-auto font-mono">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="panel p-5 xl:col-span-2">
          <ChartHeader title="Events by Type" subtitle="Distribution across categories" />
          <div className="h-64 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byType}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
                <XAxis dataKey="type" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--accent)" }} />
                <Bar dataKey="count" fill="var(--cyan)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-5">
          <ChartHeader title="Top Risk Endpoints" subtitle="Highest threat score" right={<Link to="/endpoints" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">View all <ArrowUpRight className="w-3 h-3" /></Link>} />
          <div className="mt-4 space-y-3">
            {topRisky.map(e => (
              <div key={e.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm truncate">{e.hostname}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">{e.username} · {e.ip_address}</div>
                </div>
                <div className={`font-mono font-bold text-lg ${riskClass(e.risk_score)}`}>{e.risk_score}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <ChartHeader title="Activity Timeline" subtitle="Most recent telemetry" right={<Link to="/events" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">Full log <ArrowUpRight className="w-3 h-3" /></Link>} />
        <div className="mt-4 divide-y divide-[var(--panel-border)]">
          {evs.slice(0, 8).map(ev => (
            <div key={ev.id} className="py-3 flex items-start gap-4">
              <div className={`mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded border font-mono text-[10px] uppercase tracking-wider ${severityClass(ev.severity)}`}>
                <AlertTriangle className="w-3 h-3" />
                {ev.severity}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{ev.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                  {ev.agent_id} · {eventTypeLabel[ev.event_type] ?? ev.event_type} · {relTime(ev.occurred_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--panel-border)",
  borderRadius: 8,
  fontSize: 12,
  fontFamily: "JetBrains Mono, monospace",
};

function ChartHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-semibold tracking-tight">{title}</div>
        {subtitle && <div className="text-[11px] uppercase tracking-widest font-mono text-muted-foreground mt-0.5">{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

function Kpi({ label, value, icon: Icon, accent, hint }: { label: string; value: React.ReactNode; icon: any; accent: "success"|"danger"|"warning"|"cyan"; hint?: string }) {
  const accentMap = {
    success: "text-success border-success/30",
    danger: "text-destructive border-destructive/30",
    warning: "text-warning border-warning/30",
    cyan: "text-cyan border-cyan/30",
  };
  return (
    <div className="panel p-5 relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="text-[11px] uppercase tracking-[0.18em] font-mono text-muted-foreground">{label}</div>
        <div className={`w-8 h-8 rounded-md border grid place-items-center ${accentMap[accent]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight font-mono">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground font-mono mt-1">{hint}</div>}
    </div>
  );
}
