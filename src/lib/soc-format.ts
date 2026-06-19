import { formatDistanceToNowStrict } from "date-fns";

export const eventTypeLabel: Record<string, string> = {
  failed_login: "Failed Login",
  login_success: "Login",
  usb_inserted: "USB Inserted",
  usb_removed: "USB Removed",
  system_startup: "System Startup",
  system_shutdown: "System Shutdown",
  security_alert: "Security Alert",
  heartbeat: "Heartbeat",
};

export function severityClass(sev: string) {
  switch (sev) {
    case "critical": return "text-destructive border-destructive/40 bg-destructive/10";
    case "high":     return "text-warning border-warning/40 bg-warning/10";
    case "medium":   return "text-cyan border-cyan/40 bg-cyan/10";
    case "info":     return "text-muted-foreground border-border bg-muted/30";
    default:         return "text-muted-foreground border-border bg-muted/30";
  }
}

export function riskClass(score: number) {
  if (score >= 75) return "text-destructive";
  if (score >= 50) return "text-warning";
  if (score >= 25) return "text-cyan";
  return "text-success";
}

export function riskBar(score: number) {
  if (score >= 75) return "bg-destructive";
  if (score >= 50) return "bg-warning";
  if (score >= 25) return "bg-cyan";
  return "bg-success";
}

export function relTime(d: string | Date) {
  try {
    return formatDistanceToNowStrict(new Date(d), { addSuffix: true });
  } catch { return "—"; }
}
