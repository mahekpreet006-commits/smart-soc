import { Link } from "@tanstack/react-router";
import { Shield, Activity, MonitorSmartphone, ScrollText, Network, Download } from "lucide-react";
import type { ReactNode } from "react";

const nav = [
  { to: "/", label: "Overview", icon: Activity },
  { to: "/endpoints", label: "Endpoints", icon: MonitorSmartphone },
  { to: "/events", label: "Events", icon: ScrollText },
  { to: "/architecture", label: "Architecture", icon: Network },
  { to: "/agent", label: "Deploy Agent", icon: Download },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 border-r border-[var(--panel-border)] bg-[oklch(0.18_0.025_252_/_0.7)] backdrop-blur-md flex flex-col">
        <div className="px-5 py-5 border-b border-[var(--panel-border)] flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-md bg-gradient-to-br from-primary to-cyan grid place-items-center glow-cyan">
            <Shield className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-mono text-sm font-bold tracking-tight text-glow">SENTINELX</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">SOC // v1.0</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors font-medium [&.active]:bg-accent [&.active]:text-foreground [&.active]:shadow-[inset_2px_0_0_0_var(--primary)]"
              activeProps={{ className: "active" }}
              activeOptions={{ exact: to === "/" }}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-[var(--panel-border)]">
          <div className="panel p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 pulse-dot-inner" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Ingest online</span>
            </div>
            <div className="text-[10px] font-mono text-muted-foreground/80 leading-tight">
              TLS · HMAC verified · 5m heartbeat
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 relative">
        <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
        <div className="relative">{children}</div>
      </main>
    </div>
  );
}
