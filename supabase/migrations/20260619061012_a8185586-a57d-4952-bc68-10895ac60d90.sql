
CREATE TABLE public.endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT UNIQUE NOT NULL,
  hostname TEXT NOT NULL,
  username TEXT,
  os_version TEXT,
  ip_address TEXT,
  agent_version TEXT,
  status TEXT NOT NULL DEFAULT 'online',
  risk_score INT NOT NULL DEFAULT 0,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_endpoints_status ON public.endpoints(status);
CREATE INDEX idx_endpoints_last_seen ON public.endpoints(last_seen DESC);

GRANT SELECT, INSERT, UPDATE ON public.endpoints TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.endpoints TO authenticated;
GRANT ALL ON public.endpoints TO service_role;

ALTER TABLE public.endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read endpoints" ON public.endpoints FOR SELECT USING (true);
CREATE POLICY "public insert endpoints" ON public.endpoints FOR INSERT WITH CHECK (true);
CREATE POLICY "public update endpoints" ON public.endpoints FOR UPDATE USING (true);

CREATE TABLE public.endpoint_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID REFERENCES public.endpoints(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  description TEXT,
  raw JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_endpoint ON public.endpoint_events(endpoint_id);
CREATE INDEX idx_events_type ON public.endpoint_events(event_type);
CREATE INDEX idx_events_occurred ON public.endpoint_events(occurred_at DESC);
CREATE INDEX idx_events_severity ON public.endpoint_events(severity);

GRANT SELECT, INSERT ON public.endpoint_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.endpoint_events TO authenticated;
GRANT ALL ON public.endpoint_events TO service_role;

ALTER TABLE public.endpoint_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read events" ON public.endpoint_events FOR SELECT USING (true);
CREATE POLICY "public insert events" ON public.endpoint_events FOR INSERT WITH CHECK (true);

-- Seed sample endpoints
INSERT INTO public.endpoints (agent_id, hostname, username, os_version, ip_address, agent_version, status, risk_score, last_seen)
VALUES
  ('agent-001', 'WIN-EXEC-01', 'a.morgan', 'Windows 11 Pro 23H2', '10.0.12.41', '1.0.0', 'online', 82, now() - interval '2 minutes'),
  ('agent-002', 'WIN-DEV-14', 'j.patel', 'Windows 11 Pro 23H2', '10.0.12.88', '1.0.0', 'online', 24, now() - interval '1 minute'),
  ('agent-003', 'WIN-FIN-07', 'r.chen', 'Windows 10 Enterprise 22H2', '10.0.18.12', '1.0.0', 'online', 67, now() - interval '4 minutes'),
  ('agent-004', 'WIN-HR-22', 'm.lopez', 'Windows 11 Pro 23H2', '10.0.21.5', '1.0.0', 'offline', 15, now() - interval '3 hours'),
  ('agent-005', 'WIN-OPS-09', 's.kumar', 'Windows Server 2022', '10.0.5.3', '1.0.0', 'online', 91, now() - interval '30 seconds'),
  ('agent-006', 'WIN-MKT-03', 'l.nguyen', 'Windows 11 Home 23H2', '10.0.30.17', '1.0.0', 'online', 12, now() - interval '3 minutes'),
  ('agent-007', 'WIN-LEGAL-11', 'd.silva', 'Windows 10 Pro 22H2', '10.0.40.7', '1.0.0', 'offline', 48, now() - interval '2 days'),
  ('agent-008', 'WIN-DC-01', 'svc_admin', 'Windows Server 2022', '10.0.0.4', '1.0.0', 'online', 73, now() - interval '15 seconds');

-- Seed sample events
INSERT INTO public.endpoint_events (endpoint_id, agent_id, event_type, severity, title, description, occurred_at)
SELECT e.id, e.agent_id, t.event_type, t.severity, t.title, t.description, now() - (t.mins || ' minutes')::interval
FROM public.endpoints e
JOIN (VALUES
  ('agent-005', 'failed_login', 'critical', 'Multiple failed login attempts', '12 failed RDP login attempts from 185.220.101.45', 2),
  ('agent-005', 'security_alert', 'critical', 'Brute force pattern detected', 'Sequential password attempts on Administrator account', 3),
  ('agent-001', 'usb_inserted', 'high', 'Unknown USB device inserted', 'Kingston DataTraveler 32GB (VID:0951 PID:1666)', 7),
  ('agent-001', 'failed_login', 'high', 'Failed login attempt', 'Failed login for user a.morgan from 10.0.12.41', 12),
  ('agent-003', 'security_alert', 'high', 'PowerShell execution policy bypass', 'Suspicious encoded command executed', 18),
  ('agent-003', 'usb_inserted', 'medium', 'USB storage device inserted', 'SanDisk Ultra 64GB', 25),
  ('agent-008', 'login_success', 'info', 'Administrator login', 'svc_admin logged in via remote session', 4),
  ('agent-008', 'security_alert', 'high', 'New service installed', 'Unknown service "WinUpdSvc" created', 22),
  ('agent-002', 'login_success', 'info', 'User login', 'j.patel logged in interactively', 33),
  ('agent-002', 'usb_removed', 'info', 'USB device removed', 'Logitech USB Receiver removed', 41),
  ('agent-006', 'system_startup', 'info', 'System started', 'Boot completed in 18.4s', 180),
  ('agent-004', 'system_shutdown', 'info', 'System shutdown', 'Clean shutdown initiated by user', 190),
  ('agent-007', 'failed_login', 'medium', 'Failed login', 'Account locked after 5 attempts', 2880),
  ('agent-001', 'security_alert', 'medium', 'Defender detection', 'Trojan:Win32/Wacatac.B!ml quarantined', 60),
  ('agent-005', 'failed_login', 'critical', 'Failed admin login', 'Failed login for Administrator from 45.155.205.233', 1),
  ('agent-003', 'usb_removed', 'info', 'USB device removed', 'SanDisk Ultra 64GB removed', 23)
) AS t(agent_id, event_type, severity, title, description, mins)
ON e.agent_id = t.agent_id;
