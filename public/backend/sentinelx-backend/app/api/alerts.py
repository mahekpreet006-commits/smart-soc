from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..core.deps import get_db, get_current_user
from ..models.alert import Alert
from ..schemas.alert import AlertCreate, AlertOut, AlertUpdate
from ..websockets.manager import manager

router = APIRouter(prefix="/api/alerts", tags=["alerts"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[AlertOut])
def list_alerts(
    db: Session = Depends(get_db),
    status: str | None = Query(default=None),
    severity: str | None = Query(default=None),
    limit: int = Query(default=100, le=500),
):
    q = db.query(Alert)
    if status:
        q = q.filter(Alert.status == status)
    if severity:
        q = q.filter(Alert.severity == severity)
    return q.order_by(Alert.created_at.desc()).limit(limit).all()


@router.post("", response_model=AlertOut)
async def create_alert(payload: AlertCreate, db: Session = Depends(get_db)):
    alert = Alert(**payload.model_dump())
    db.add(alert)
    db.commit()
    db.refresh(alert)
    await manager.broadcast("alert.created", AlertOut.model_validate(alert).model_dump())
    return alert


@router.patch("/{alert_id}", response_model=AlertOut)
async def update_alert(alert_id: int, payload: AlertUpdate, db: Session = Depends(get_db)):
    a = db.get(Alert, alert_id)
    if not a:
        raise HTTPException(404, "Alert not found")
    a.status = payload.status
    db.commit()
    db.refresh(a)
    await manager.broadcast("alert.updated", AlertOut.model_validate(a).model_dump())
    return a
