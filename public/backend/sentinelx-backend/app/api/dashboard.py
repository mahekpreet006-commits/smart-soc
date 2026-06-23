from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core.deps import get_db, get_current_user
from ..models.alert import Alert
from ..models.endpoint import Endpoint
from ..models.event import Event

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"], dependencies=[Depends(get_current_user)])


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)

    online = db.query(func.count(Endpoint.id)).filter(Endpoint.status == "online").scalar() or 0
    offline = db.query(func.count(Endpoint.id)).filter(Endpoint.status != "online").scalar() or 0
    critical_alerts = (
        db.query(func.count(Alert.id))
        .filter(Alert.severity == "critical", Alert.status == "open")
        .scalar() or 0
    )
    failed_logins = (
        db.query(func.count(Event.id))
        .filter(Event.event_type.in_(["failed_login", "multiple_failed_logins", "brute_force"]))
        .filter(Event.timestamp >= day_ago)
        .scalar() or 0
    )
    usb_activity = (
        db.query(func.count(Event.id))
        .filter(Event.event_type.in_(["usb_inserted", "usb_removed"]))
        .filter(Event.timestamp >= day_ago)
        .scalar() or 0
    )

    severity_rows = (
        db.query(Alert.severity, func.count(Alert.id))
        .group_by(Alert.severity)
        .all()
    )
    type_rows = (
        db.query(Event.event_type, func.count(Event.id))
        .filter(Event.timestamp >= day_ago)
        .group_by(Event.event_type)
        .all()
    )
    top_risk = (
        db.query(Endpoint)
        .order_by(Endpoint.threat_score.desc())
        .limit(5)
        .all()
    )
    recent_events = (
        db.query(Event).order_by(Event.timestamp.desc()).limit(20).all()
    )

    return {
        "online_endpoints": online,
        "offline_endpoints": offline,
        "critical_alerts": critical_alerts,
        "failed_logins_24h": failed_logins,
        "usb_activity_24h": usb_activity,
        "severity_distribution": {sev: cnt for sev, cnt in severity_rows},
        "event_type_distribution": {t: cnt for t, cnt in type_rows},
        "top_risk_endpoints": [
            {"id": e.id, "hostname": e.hostname, "ip": e.ip_address, "score": e.threat_score, "status": e.status}
            for e in top_risk
        ],
        "recent_activity": [
            {
                "id": ev.id,
                "endpoint_id": ev.endpoint_id,
                "event_type": ev.event_type,
                "message": ev.message,
                "severity": ev.severity,
                "timestamp": ev.timestamp,
            }
            for ev in recent_events
        ],
    }
