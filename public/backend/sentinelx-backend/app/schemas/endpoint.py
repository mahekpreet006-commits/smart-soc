from datetime import datetime
from pydantic import BaseModel, ConfigDict


class EndpointRegister(BaseModel):
    agent_id: str
    hostname: str
    ip_address: str
    os: str


class EndpointHeartbeat(BaseModel):
    agent_id: str
    ip_address: str | None = None
    status: str = "online"


class EndpointOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    agent_id: str
    hostname: str
    ip_address: str
    os: str
    status: str
    last_seen: datetime
    threat_score: int
