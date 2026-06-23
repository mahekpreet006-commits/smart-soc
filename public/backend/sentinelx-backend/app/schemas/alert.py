from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class AlertCreate(BaseModel):
    endpoint_id: int | None = None
    severity: str = Field(pattern="^(info|medium|high|critical)$")
    title: str
    description: str = ""


class AlertUpdate(BaseModel):
    status: str = Field(pattern="^(open|ack|closed)$")


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    endpoint_id: int | None
    severity: str
    title: str
    description: str
    status: str
    created_at: datetime
