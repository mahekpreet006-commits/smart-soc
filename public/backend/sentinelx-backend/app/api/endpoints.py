from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..core.deps import get_db, get_current_user, require_admin, require_agent_key
from ..models.endpoint import Endpoint
from ..schemas.endpoint import EndpointOut, EndpointRegister, EndpointHeartbeat
from ..websockets.manager import manager

router = APIRouter(prefix="/api/endpoints", tags=["endpoints"])


@router.get("", response_model=list[EndpointOut], dependencies=[Depends(get_current_user)])
def list_endpoints(db: Session = Depends(get_db)):
    return db.query(Endpoint).order_by(Endpoint.last_seen.desc()).all()


@router.get("/{endpoint_id}", response_model=EndpointOut, dependencies=[Depends(get_current_user)])
def get_endpoint(endpoint_id: int, db: Session = Depends(get_db)):
    ep = db.get(Endpoint, endpoint_id)
    if not ep:
        raise HTTPException(404, "Endpoint not found")
    return ep


@router.delete("/{endpoint_id}", dependencies=[Depends(require_admin)])
def delete_endpoint(endpoint_id: int, db: Session = Depends(get_db)):
    ep = db.get(Endpoint, endpoint_id)
    if not ep:
        raise HTTPException(404, "Endpoint not found")
    db.delete(ep)
    db.commit()
    return {"ok": True}


@router.post("/register", response_model=EndpointOut, dependencies=[Depends(require_agent_key)])
async def register_endpoint(payload: EndpointRegister, db: Session = Depends(get_db)):
    ep = db.query(Endpoint).filter(Endpoint.agent_id == payload.agent_id).first()
    if ep:
        ep.hostname = payload.hostname
        ep.ip_address = payload.ip_address
        ep.os = payload.os
        ep.status = "online"
        ep.last_seen = datetime.now(timezone.utc)
    else:
        ep = Endpoint(**payload.model_dump(), status="online")
        db.add(ep)
    db.commit()
    db.refresh(ep)
    await manager.broadcast("endpoint.status", {"id": ep.id, "status": ep.status, "hostname": ep.hostname})
    return ep


@router.post("/heartbeat", response_model=EndpointOut, dependencies=[Depends(require_agent_key)])
async def heartbeat(payload: EndpointHeartbeat, db: Session = Depends(get_db)):
    ep = db.query(Endpoint).filter(Endpoint.agent_id == payload.agent_id).first()
    if not ep:
        raise HTTPException(404, "Endpoint not registered")
    prev = ep.status
    ep.status = payload.status
    if payload.ip_address:
        ep.ip_address = payload.ip_address
    ep.last_seen = datetime.now(timezone.utc)
    db.commit()
    db.refresh(ep)
    if prev != ep.status:
        await manager.broadcast("endpoint.status", {"id": ep.id, "status": ep.status})
    return ep
