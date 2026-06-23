from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..core.deps import get_db, get_current_user, require_agent_key
from ..models.endpoint import Endpoint
from ..models.event import Event
from ..schemas.event import EventCreate, EventOut
from ..websockets.manager import manager

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("", response_model=list[EventOut], dependencies=[Depends(get_current_user)])
def list_events(
    db: Session = Depends(get_db),
    event_type: str | None = Query(default=None),
    endpoint_id: int | None = Query(default=None),
    limit: int = Query(default=200, le=1000),
):
    q = db.query(Event)
    if event_type:
        q = q.filter(Event.event_type == event_type)
    if endpoint_id:
        q = q.filter(Event.endpoint_id == endpoint_id)
    return q.order_by(Event.timestamp.desc()).limit(limit).all()


@router.post("", response_model=EventOut, dependencies=[Depends(require_agent_key)])
async def ingest_event(payload: EventCreate, db: Session = Depends(get_db)):
    endpoint_id = payload.endpoint_id
    if not endpoint_id and payload.agent_id:
        ep = db.query(Endpoint).filter(Endpoint.agent_id == payload.agent_id).first()
        if not ep:
            raise HTTPException(404, "Agent not registered")
        endpoint_id = ep.id
    ev = Event(
        endpoint_id=endpoint_id,
        event_type=payload.event_type,
        message=payload.message,
        severity=payload.severity,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    await manager.broadcast("event.created", EventOut.model_validate(ev).model_dump())
    return ev
