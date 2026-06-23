import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, status
from fastapi.middleware.cors import CORSMiddleware

from .api import alerts, auth, dashboard, endpoints, events, threat_intel, users
from .core.config import settings
from .core.security import decode_token, hash_password
from .db.base import Base
from .db.session import SessionLocal, engine
from .models.user import User
from .services.simulator import run_simulator
from .websockets.manager import manager


def _seed_admin() -> None:
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.username == settings.ADMIN_USERNAME).first():
            db.add(User(
                username=settings.ADMIN_USERNAME,
                email=settings.ADMIN_EMAIL,
                password_hash=hash_password(settings.ADMIN_PASSWORD),
                role="admin",
            ))
            db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Safety net for dev when migrations aren't run yet
    Base.metadata.create_all(bind=engine)
    _seed_admin()
    task = asyncio.create_task(run_simulator())
    try:
        yield
    finally:
        task.cancel()


app = FastAPI(
    title="SentinelX SOC API",
    version="1.0.0",
    description="Security Operations Center backend: endpoints, alerts, events, real-time WS.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(endpoints.router)
app.include_router(alerts.router)
app.include_router(events.router)
app.include_router(threat_intel.router)
app.include_router(dashboard.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "service": "sentinelx-api"}


@app.websocket("/ws/dashboard")
async def ws_dashboard(websocket: WebSocket, token: str = Query(...)):
    try:
        payload = decode_token(token)
        if payload.get("role") not in ("admin", "analyst"):
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except ValueError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(websocket)
    try:
        while True:
            # Keep-alive; clients can ping to keep the socket warm.
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception:
        await manager.disconnect(websocket)
