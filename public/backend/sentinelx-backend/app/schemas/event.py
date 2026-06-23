from datetime import datetime
from pydantic import BaseModel, ConfigDict


class EventCreate(BaseModel):
    agent_id: str | None = None
    endpoint_id: int | None = None
    event_type: str
    message: str = ""
    severity: str = "info"


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    endpoint_id: int | None
    event_type: str
    message: str
    severity: str
    timestamp: datetime
