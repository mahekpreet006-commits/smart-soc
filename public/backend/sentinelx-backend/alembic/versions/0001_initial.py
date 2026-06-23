"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-06-23
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("username", sa.String(64), nullable=False, unique=True, index=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(16), nullable=False, server_default="analyst"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "endpoints",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("agent_id", sa.String(128), nullable=False, unique=True, index=True),
        sa.Column("hostname", sa.String(255), nullable=False),
        sa.Column("ip_address", sa.String(45), nullable=False),
        sa.Column("os", sa.String(128), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="online"),
        sa.Column("last_seen", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("threat_score", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "alerts",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("endpoint_id", sa.Integer, sa.ForeignKey("endpoints.id", ondelete="CASCADE")),
        sa.Column("severity", sa.String(16), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=False, server_default=""),
        sa.Column("status", sa.String(16), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_alerts_endpoint", "alerts", ["endpoint_id"])
    op.create_index("ix_alerts_status", "alerts", ["status"])
    op.create_table(
        "events",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("endpoint_id", sa.Integer, sa.ForeignKey("endpoints.id", ondelete="CASCADE")),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("message", sa.Text, nullable=False, server_default=""),
        sa.Column("severity", sa.String(16), nullable=False, server_default="info"),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_events_endpoint", "events", ["endpoint_id"])
    op.create_index("ix_events_type", "events", ["event_type"])
    op.create_index("ix_events_ts", "events", ["timestamp"])


def downgrade() -> None:
    op.drop_table("events")
    op.drop_table("alerts")
    op.drop_table("endpoints")
    op.drop_table("users")
