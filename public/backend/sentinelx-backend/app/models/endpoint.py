from datetime import datetime
from sqlalchemy import String, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db.base import Base


class Endpoint(Base):
    __tablename__ = "endpoints"

    id: Mapped[int] = mapped_column(primary_key=True)
    agent_id: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    hostname: Mapped[str] = mapped_column(String(255))
    ip_address: Mapped[str] = mapped_column(String(45))
    os: Mapped[str] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(16), default="online")
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    threat_score: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    alerts = relationship("Alert", backref="endpoint", cascade="all, delete-orphan")
    events = relationship("Event", backref="endpoint", cascade="all, delete-orphan")
