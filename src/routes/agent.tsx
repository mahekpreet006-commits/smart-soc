import { createFileRoute } from "@tanstack/react-router";
import { Download, Terminal, Shield, Copy, Check } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/agent")({
  head: () => ({
    meta: [
      { title: "Deploy SentinelX Agent — Windows" },
      { name: "description", content: "Download and install the lightweight SentinelX Python agent for Windows endpoint telemetry." },
    ],
  }),
  component: AgentPage,
});

const INSTALL = `# 1. Save the agent file (sentinelx_agent.py)
# 2. Install runtime deps
python -m pip install requests pywin32 wmi

# 3. Configure
set SENTINELX_API_URL=https://your-soc-host/api/public/ingest
set SENTINELX_API_KEY=YOUR_AGENT_API_KEY

# 4. Run (or install as a Windows Service via NSSM)
python sentinelx_agent.py`;

function AgentPage() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="p-8 space-y-6 max-w-5xl">
      <header>
        <div className="text-xs font-mono uppercase tracking-[0.2em] text-cyan text-glow">// agent rollout</div>
        <h1 className="text-3xl font-bold mt-1 tracking-tight">Deploy the SentinelX Agent</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          A lightweight (~20MB RAM) Python agent for Windows 10/11 and Windows Server. Forwards security events, USB activity and heartbeats to this SOC over HTTPS.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Feature icon={Shield} title="Secure" text="HTTPS + X-Agent-Key signed requests. Anonymous DB writes disabled." />
        <Feature icon={Terminal} title="Native APIs" text="WinEvent log + WMI USB hooks. No third-party kernel drivers." />
        <Feature icon={Download} title="Tiny footprint" text="Single Python file. Runs as a Windows Service." />
      </div>

      <div className="panel p-6 flex items-center gap-6 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-mono uppercase tracking-widest text-muted-foreground">sentinelx_agent.py</div>
          <div className="text-xl font-bold mt-1">Python · Windows 10/11 · Server 2019+</div>
          <div className="text-xs text-muted-foreground mt-2 font-mono">SHA · build 1.0.0 · MIT licensed</div>
        </div>
        <a
          href="/agent/sentinelx_agent.py"
          download
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-md font-semibold text-sm glow-cyan hover:opacity-90 transition"
        >
          <Download className="w-4 h-4" />
          Download agent
        </a>
      </div>

      <div className="panel p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-mono uppercase tracking-widest text-muted-foreground">install.cmd</div>
          <button
            onClick={() => { navigator.clipboard.writeText(INSTALL); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-border text-xs font-mono hover:bg-accent"
          >
            {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="text-xs font-mono leading-relaxed text-cyan overflow-x-auto whitespace-pre-wrap">{INSTALL}</pre>
      </div>

      <div className="panel p-6">
        <div className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-3">What the agent collects</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          {[
            "Computer name, username, OS version",
            "Local IP and last-seen timestamp",
            "Interactive + remote login events (4624)",
            "Failed logins and account lockouts (4625, 4740)",
            "USB device insertion / removal",
            "System startup and shutdown",
            "Defender / Security Event Log alerts",
            "Heartbeat every 5 minutes",
          ].map(x => (
            <div key={x} className="flex gap-2"><span className="text-cyan font-mono">›</span> {x}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <div className="panel p-5">
      <div className="w-9 h-9 rounded-md border border-cyan/40 grid place-items-center text-cyan">
        <Icon className="w-4 h-4" />
      </div>
      <div className="mt-3 font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{text}</div>
    </div>
  );
}
