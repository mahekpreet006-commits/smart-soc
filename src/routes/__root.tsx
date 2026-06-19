import { createRootRouteWithContext, HeadContent, Outlet, Scripts, useRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppShell } from "@/components/AppShell";

function NotFound() {
  return (
    <AppShell>
      <div className="p-12 font-mono">
        <div className="text-7xl font-bold text-glow">404</div>
        <div className="mt-2 text-muted-foreground">Route not found in this SOC tenant.</div>
      </div>
    </AppShell>
  );
}

function ErrorView({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "root" }); }, [error]);
  return (
    <AppShell>
      <div className="p-12 font-mono">
        <div className="text-warning text-xs uppercase tracking-widest">// runtime exception</div>
        <h1 className="text-2xl mt-1">An error broke this view</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-lg">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
        >Retry</button>
      </div>
    </AppShell>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SentinelX SOC — Endpoint Telemetry" },
      { name: "description", content: "Windows endpoint monitoring, telemetry ingest and threat analytics for security operations." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" },
    ],
  }),
  shellComponent: Shell,
  component: RootComp,
  notFoundComponent: NotFound,
  errorComponent: ErrorView,
});

function Shell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComp() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell><Outlet /></AppShell>
    </QueryClientProvider>
  );
}
