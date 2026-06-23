"""
SentinelX Windows Endpoint Agent
================================

Lightweight Python agent for Windows 10/11/Server endpoints. Registers
itself with the SentinelX SOC backend, then polls Windows Event Logs and
USB devices every 30 seconds, forwarding telemetry over HTTPS.

ENV:
    SENTINELX_API_URL   e.g. http://soc.local:8000
    SENTINELX_API_KEY   shared agent key (matches backend AGENT_API_KEY)
    SENTINELX_AGENT_ID  (optional) stable id, defaults to hostname-mac

Install:
    pip install -r requirements.txt
Run:
    python sentinelx_agent.py
"""
from __future__ import annotations
import logging, os, platform, socket, sys, time, uuid
from datetime import datetime, timezone
from typing import Any
import requests

try:
    import win32evtlog                                        # type: ignore
    import wmi                                                # type: ignore
    WIN = True
except Exception:
    WIN = False

POLL_INTERVAL = 30
VERSION = "1.0.0"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("sentinelx")

SECURITY_EVENT_MAP: dict[int, tuple[str, str]] = {
    4624: ("admin_login",          "medium"),
    4625: ("failed_login",         "high"),
    4740: ("brute_force",          "critical"),
    4720: ("new_service_installed","high"),
    7045: ("new_service_installed","high"),
    4104: ("powershell_bypass",    "critical"),
}


def local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]; s.close()
        return ip
    except Exception:
        return socket.gethostbyname(socket.gethostname())


def os_version() -> str:
    return f"{platform.system()} {platform.release()} ({platform.version()})"


def agent_id() -> str:
    return os.environ.get("SENTINELX_AGENT_ID") or f"{socket.gethostname()}-{uuid.getnode():012x}"


class Backend:
    def __init__(self, base: str, key: str) -> None:
        self.base = base.rstrip("/")
        self.headers = {"X-Agent-Key": key, "User-Agent": f"SentinelX-Agent/{VERSION}"}
        self.s = requests.Session()

    def post(self, path: str, body: dict[str, Any]) -> bool:
        try:
            r = self.s.post(f"{self.base}{path}", json=body, headers=self.headers, timeout=15)
            if r.status_code >= 400:
                log.warning("%s -> %s %s", path, r.status_code, r.text[:200])
                return False
            return True
        except requests.RequestException as e:
            log.warning("%s failed: %s", path, e)
            return False


class EvtCollector:
    def __init__(self) -> None:
        self._last: dict[str, int] = {}

    def poll(self) -> list[dict[str, Any]]:
        if not WIN:
            return []
        out: list[dict[str, Any]] = []
        for log_name in ("Security", "System"):
            try:
                out.extend(self._read(log_name))
            except Exception as e:
                log.debug("read %s failed: %s", log_name, e)
        return out

    def _read(self, log_name: str) -> list[dict[str, Any]]:
        h = win32evtlog.OpenEventLog(None, log_name)
        flags = win32evtlog.EVENTLOG_BACKWARDS_READ | win32evtlog.EVENTLOG_SEQUENTIAL_READ
        last = self._last.get(log_name, 0)
        new_last = last
        items: list[dict[str, Any]] = []
        try:
            records = win32evtlog.ReadEventLog(h, flags, 0)
            for r in records[:50]:
                if last and r.RecordNumber <= last:
                    break
                new_last = max(new_last, r.RecordNumber)
                eid = r.EventID & 0xFFFF
                mapping = SECURITY_EVENT_MAP.get(eid)
                if not mapping:
                    continue
                etype, sev = mapping
                desc = " | ".join(str(s) for s in (r.StringInserts or []) if s)[:500]
                items.append({
                    "event_type": etype,
                    "severity": sev,
                    "message": f"[{log_name} {eid}] {desc}" if desc else f"[{log_name} {eid}]",
                })
            self._last[log_name] = new_last or last
        finally:
            win32evtlog.CloseEventLog(h)
        return list(reversed(items))


class UsbMonitor:
    def __init__(self) -> None:
        self._known: set[str] = set()
        self._primed = False
        self._c = wmi.WMI() if WIN else None

    def poll(self) -> list[dict[str, Any]]:
        if not WIN or not self._c:
            return []
        out: list[dict[str, Any]] = []
        current = set()
        try:
            for d in self._c.Win32_DiskDrive(InterfaceType="USB"):
                key = d.PNPDeviceID
                current.add(key)
                if self._primed and key not in self._known:
                    out.append({
                        "event_type": "usb_inserted", "severity": "high",
                        "message": f"USB inserted: {d.Model}",
                    })
            for missing in self._known - current:
                if self._primed:
                    out.append({
                        "event_type": "usb_removed", "severity": "info",
                        "message": f"USB removed: {missing}",
                    })
        except Exception as e:
            log.debug("usb poll: %s", e)
        self._known = current
        self._primed = True
        return out


def main() -> None:
    url = os.environ.get("SENTINELX_API_URL")
    key = os.environ.get("SENTINELX_API_KEY")
    if not url or not key:
        print("SENTINELX_API_URL and SENTINELX_API_KEY must be set", file=sys.stderr)
        sys.exit(2)

    aid = agent_id()
    api = Backend(url, key)
    api.post("/api/endpoints/register", {
        "agent_id": aid, "hostname": socket.gethostname(),
        "ip_address": local_ip(), "os": os_version(),
    })
    log.info("Registered %s (%s)", socket.gethostname(), aid)

    evt = EvtCollector()
    usb = UsbMonitor()

    while True:
        api.post("/api/endpoints/heartbeat", {
            "agent_id": aid, "ip_address": local_ip(), "status": "online",
        })
        for ev in evt.poll() + usb.poll():
            api.post("/api/events", {"agent_id": aid, **ev})
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log.info("agent stopped")
