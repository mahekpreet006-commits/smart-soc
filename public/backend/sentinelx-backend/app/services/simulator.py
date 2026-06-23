"""Background task that generates realistic SOC events for demo purposes."""
import asyncio
import random
from datetime import datetime, timezone

from ..core.config import settings
from ..db.session import SessionLocal
from ..models.alert import Alert
from ..models.endpoint import Endpoint
from ..models.event import Event
from ..schemas.alert import AlertOut
from ..schemas.event import EventOut
from ..websockets.manager import manager

SIM_HOSTS = [
    ("WIN-FINANCE-01", "10.0.12.21", "Windows 11 Pro"),
    ("WIN-HR-04",      "10.0.12.42", "Windows 10 Pro"),
    ("WIN-DEV-09",     "10.0.20.19", "Windows 11 Enterprise"),
    ("WIN-DC-01",      "10.0.0.10",  "Windows Server 2022"),
    ("WIN-SALES-12",   "10.0.30.55", "Windows 11 Pro"),
]

EVENT_PROFILES = [
    ("failed_login",            "high",     "Failed login for user {user} from {ip}"),
    ("multiple_failed_logins",  "high",     "5 failed logins for {user} in 60s"),
    ("brute_force",             "critical", "Brute-force pattern detected against {user}"),
    ("usb_inserted",            "high",     "USB storage inserted: {model}"),
    ("usb_removed",             "info",     "USB device removed"),
    ("powershell_bypass",       "critical", "PowerShell -ExecutionPolicy Bypass invoked by {user}"),
    ("new_service_installed",   "high",     "New service installed: {svc}"),
    ("admin_login",             "medium",   "Administrator login from {ip}"),
]

USERS = ["jdoe", "asmith", "operator", "svc_backup", "root", "administrator"]
SERVICES = ["WinRMHelper", "UpdateOrchestrator", "RemoteSupport", "CrySvc"]
USB_MODELS = ["SanDisk Cruzer 64GB", "Kingston DT100 32GB", "Unknown USB Mass Storage"]


async def _seed_endpoints():
    db = SessionLocal()
    try:
        for hostname, ip, osv in SIM_HOSTS:
            agent_id = f"sim-{hostname.lower()}"
            if not db.query(Endpoint).filter(Endpoint.agent_id == agent_id).first():
                db.add(Endpoint(
                    agent_id=agent_id, hostname=hostname, ip_address=ip,
                    os=osv, status="online", threat_score=random.randint(5, 40),
                ))
        db.commit()
    finally:
        db.close()


async def _tick():
    db = SessionLocal()
    try:
        endpoints = db.query(Endpoint).all()
        if not endpoints:
            return
        ep = random.choice(endpoints)
        etype, severity, template = random.choice(EVENT_PROFILES)
        msg = template.format(
            user=random.choice(USERS),
            ip=f"10.0.{random.randint(0,40)}.{random.randint(2,250)}",
            model=random.choice(USB_MODELS),
            svc=random.choice(SERVICES),
        )

        ev = Event(endpoint_id=ep.id, event_type=etype, message=msg, severity=severity)
        db.add(ev)

        # Bump threat score and possibly create an alert
        bump = {"info": 1, "medium": 3, "high": 6, "critical": 12}[severity]
        ep.threat_score = min(100, ep.threat_score + bump)
        ep.last_seen = datetime.now(timezone.utc)

        alert = None
        if severity in ("high", "critical") and random.random() < 0.6:
            alert = Alert(
                endpoint_id=ep.id, severity=severity,
                title=etype.replace("_", " ").title(),
                description=msg,
            )
            db.add(alert)

        # Occasionally flip a host offline/online
        if random.random() < 0.03:
            new_status = "offline" if ep.status == "online" else "online"
            ep.status = new_status
            await manager.broadcast("endpoint.status", {"id": ep.id, "status": new_status})

        db.commit()
        db.refresh(ev)
        await manager.broadcast("event.created", EventOut.model_validate(ev).model_dump())
        if alert:
            db.refresh(alert)
            await manager.broadcast("alert.created", AlertOut.model_validate(alert).model_dump())
    finally:
        db.close()


async def run_simulator():
    if not settings.SIMULATOR_ENABLED:
        return
    await _seed_endpoints()
    while True:
        try:
            await _tick()
        except Exception as e:  # noqa: BLE001
            print(f"[simulator] tick failed: {e}")
        await asyncio.sleep(settings.SIMULATOR_INTERVAL_SECONDS)
