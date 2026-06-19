"""
SentinelX Windows Endpoint Agent
================================

Lightweight telemetry agent for Windows 10/11 and Windows Server.
Sends device info, login events, USB events, and security log events
to the SentinelX SOC dashboard over HTTPS.

Configuration (environment variables):
    SENTINELX_API_URL   Full URL to the ingest endpoint
                        e.g. https://your-soc.lovable.app/api/public/ingest
    SENTINELX_API_KEY   Shared agent key issued by the SOC
    SENTINELX_AGENT_ID  (optional) stable agent id, defaults to hostname-mac

Install:
    pip install requests pywin32 wmi
Run:
    python sentinelx_agent.py

Install as a service (recommended) using NSSM:
    nssm install SentinelX "C:\\Python311\\python.exe" "C:\\sentinelx\\sentinelx_agent.py"
"""

from __future__ import annotations

import json
import logging
import os
import platform
import socket
import sys
import time
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from threading import Event, Thread
from typing import Any, Dict, List, Optional

import requests

# ---------- Optional Windows-only deps (graceful fallback for dev) ----------
try:
    import win32evtlog        # type: ignore
    import win32evtlogutil    # type: ignore
    import win32con           # type: ignore
    import wmi                # type: ignore
    WIN = True
except Exception:
    WIN = False

# ---------------------------------------------------------------------------

VERSION = "1.0.0"
HEARTBEAT_INTERVAL = 5 * 60   # 5 minutes
EVENT_POLL_INTERVAL = 30      # seconds
USB_POLL_INTERVAL = 5         # seconds
BATCH_MAX = 50
RETRY_BACKOFF = [2, 5, 10, 30, 60, 120, 300]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("sentinelx")


# ---------- Data shapes ----------------------------------------------------

@dataclass
class Event:
    event_type: str
    title: str
    severity: str = "info"        # info | medium | high | critical
    description: str = ""
    occurred_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    raw: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Payload:
    agent_id: str
    hostname: str
    username: str
    os_version: str
    ip_address: str
    agent_version: str = VERSION
    events: List[Event] = field(default_factory=list)


# ---------- Helpers --------------------------------------------------------

def get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return socket.gethostbyname(socket.gethostname())


def get_username() -> str:
    return os.environ.get("USERNAME") or os.environ.get("USER") or "SYSTEM"


def get_os_version() -> str:
    if WIN:
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows NT\CurrentVersion") as k:
                product = winreg.QueryValueEx(k, "ProductName")[0]
                build = winreg.QueryValueEx(k, "CurrentBuild")[0]
            return f"{product} (build {build})"
        except Exception:
            pass
    return f"{platform.system()} {platform.release()}"


def stable_agent_id() -> str:
    explicit = os.environ.get("SENTINELX_AGENT_ID")
    if explicit:
        return explicit
    mac = uuid.getnode()
    return f"{socket.gethostname()}-{mac:012x}"


# ---------- Collectors -----------------------------------------------------

SEV_MAP = {
    1: "critical",   # Critical
    2: "high",       # Error
    3: "medium",     # Warning
    4: "info",       # Information
    5: "info",       # Verbose
}

# Map well-known Windows Security Event IDs to (event_type, severity, title)
SECURITY_EVENT_MAP = {
    4624: ("login_success", "info",      "User login"),
    4625: ("failed_login",  "high",      "Failed login attempt"),
    4634: ("login_success", "info",      "User logoff"),
    4647: ("login_success", "info",      "User-initiated logoff"),
    4720: ("security_alert","high",      "User account created"),
    4724: ("security_alert","high",      "Password reset attempt"),
    4740: ("failed_login",  "critical",  "User account locked out"),
    1102: ("security_alert","critical",  "Security log cleared"),
    7045: ("security_alert","high",      "New service installed"),
}


class EventLogCollector:
    """Reads Windows Security/System event logs since the last poll."""

    def __init__(self) -> None:
        self.last_record: Dict[str, int] = {}

    def collect(self) -> List[Event]:
        if not WIN:
            return []
        out: List[Event] = []
        for log_name in ("Security", "System"):
            try:
                out.extend(self._read(log_name))
            except Exception as e:
                log.debug("event log %s read failed: %s", log_name, e)
        return out

    def _read(self, log_name: str) -> List[Event]:
        h = win32evtlog.OpenEventLog(None, log_name)
        flags = win32evtlog.EVENTLOG_BACKWARDS_READ | win32evtlog.EVENTLOG_SEQUENTIAL_READ
        events: List[Event] = []
        last = self.last_record.get(log_name, 0)
        new_last = last
        try:
            records = win32evtlog.ReadEventLog(h, flags, 0)
            for r in records[:100]:
                rec_no = r.RecordNumber
                if last and rec_no <= last:
                    break
                new_last = max(new_last, rec_no)
                eid = r.EventID & 0xFFFF
                mapping = SECURITY_EVENT_MAP.get(eid)
                if not mapping:
                    if r.EventType not in (1, 2):  # only Error/Critical from unmapped
                        continue
                    etype, sev, title = "security_alert", SEV_MAP.get(r.EventType, "info"), f"{log_name} event {eid}"
                else:
                    etype, sev, title = mapping
                desc = " | ".join(str(s) for s in (r.StringInserts or []) if s)[:500]
                events.append(Event(
                    event_type=etype, severity=sev, title=title,
                    description=f"[{log_name} {eid}] {desc}" if desc else f"[{log_name} {eid}]",
                    occurred_at=r.TimeGenerated.Format("%Y-%m-%dT%H:%M:%S%z") or datetime.now(timezone.utc).isoformat(),
                    raw={"event_id": eid, "source": r.SourceName, "log": log_name},
                ))
            self.last_record[log_name] = new_last or last
        finally:
            win32evtlog.CloseEventLog(h)
        return list(reversed(events))


class USBMonitor:
    """Polls WMI for USB volume insertion / removal."""

    def __init__(self) -> None:
        self._known: set[str] = set()
        self._primed = False
        self._c = wmi.WMI() if WIN else None

    def collect(self) -> List[Event]:
        if not WIN or not self._c:
            return []
        out: List[Event] = []
        current = set()
        try:
            for d in self._c.Win32_DiskDrive(InterfaceType="USB"):
                key = f"{d.PNPDeviceID}"
                current.add(key)
                if self._primed and key not in self._known:
                    out.append(Event(
                        event_type="usb_inserted", severity="high",
                        title="USB storage device inserted",
                        description=f"{d.Model} ({d.Size or 'unknown size'} bytes)",
                        raw={"pnp": key, "model": d.Model},
                    ))
            for missing in self._known - current:
                if self._primed:
                    out.append(Event(
                        event_type="usb_removed", severity="info",
                        title="USB device removed", description=missing, raw={"pnp": missing},
                    ))
        except Exception as e:
            log.debug("USB poll failed: %s", e)
        self._known = current
        self._primed = True
        return out


# ---------- Transport ------------------------------------------------------

class Transport:
    def __init__(self, url: str, key: str) -> None:
        self.url = url
        self.key = key
        self._session = requests.Session()

    def send(self, payload: Payload) -> bool:
        body = {
            **{k: v for k, v in asdict(payload).items() if k != "events"},
            "events": [asdict(e) for e in payload.events],
        }
        headers = {
            "Content-Type": "application/json",
            "X-Agent-Key": self.key,
            "User-Agent": f"SentinelX-Agent/{VERSION}",
        }
        for delay in [0, *RETRY_BACKOFF]:
            if delay:
                time.sleep(delay)
            try:
                r = self._session.post(self.url, data=json.dumps(body), headers=headers, timeout=15)
                if r.status_code == 200:
                    return True
                log.warning("ingest returned %s: %s", r.status_code, r.text[:200])
                if r.status_code in (400, 401, 403):
                    return False  # don't retry permanent errors
            except requests.RequestException as e:
                log.warning("ingest request failed: %s", e)
        return False


# ---------- Main loop ------------------------------------------------------

class Agent:
    def __init__(self) -> None:
        url = os.environ.get("SENTINELX_API_URL")
        key = os.environ.get("SENTINELX_API_KEY")
        if not url or not key:
            log.error("SENTINELX_API_URL and SENTINELX_API_KEY must be set")
            sys.exit(2)
        self.transport = Transport(url, key)
        self.agent_id = stable_agent_id()
        self.evlog = EventLogCollector()
        self.usb = USBMonitor()
        self.stop = Event()
        self.buffer: List[Event] = []

    def build_payload(self, events: List[Event]) -> Payload:
        return Payload(
            agent_id=self.agent_id,
            hostname=socket.gethostname(),
            username=get_username(),
            os_version=get_os_version(),
            ip_address=get_local_ip(),
            events=events,
        )

    def flush(self, force: bool = False) -> None:
        if not self.buffer and not force:
            return
        chunk = self.buffer[:BATCH_MAX]
        payload = self.build_payload(chunk)
        log.info("flushing %d events", len(chunk))
        if self.transport.send(payload):
            self.buffer = self.buffer[len(chunk):]
        else:
            log.warning("ingest failed, %d events buffered", len(self.buffer))

    def run(self) -> None:
        log.info("SentinelX agent %s starting | agent_id=%s", VERSION, self.agent_id)
        # Initial registration / heartbeat
        self.buffer.append(Event(
            event_type="system_startup", severity="info",
            title="Agent started", description=f"SentinelX agent {VERSION} online",
        ))
        self.flush(force=True)

        last_hb = time.time()
        last_evlog = 0.0
        last_usb = 0.0

        try:
            while not self.stop.is_set():
                now = time.time()

                if now - last_evlog >= EVENT_POLL_INTERVAL:
                    self.buffer.extend(self.evlog.collect())
                    last_evlog = now

                if now - last_usb >= USB_POLL_INTERVAL:
                    self.buffer.extend(self.usb.collect())
                    last_usb = now

                if self.buffer:
                    self.flush()

                if now - last_hb >= HEARTBEAT_INTERVAL:
                    self.buffer.append(Event(
                        event_type="heartbeat", severity="info",
                        title="Heartbeat",
                        description=f"Agent healthy | uptime {int(now - last_hb)}s",
                    ))
                    self.flush(force=True)
                    last_hb = now

                self.stop.wait(2)
        except KeyboardInterrupt:
            pass
        finally:
            self.buffer.append(Event(
                event_type="system_shutdown", severity="info",
                title="Agent stopped", description="SentinelX agent shutting down",
            ))
            self.flush(force=True)
            log.info("agent stopped")


if __name__ == "__main__":
    Agent().run()
