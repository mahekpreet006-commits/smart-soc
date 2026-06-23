# SentinelX SOC Backend

Production-grade FastAPI backend powering the SentinelX Security Operations
Center dashboard. Provides REST + WebSocket APIs, JWT auth with role-based
access control (Admin / Analyst), PostgreSQL persistence via SQLAlchemy,
Alembic migrations, an event simulator, and a Windows endpoint agent.

## Project Structure

```
sentinelx-backend/
├── app/
│   ├── main.py                  # FastAPI entry, routers, WS, CORS
│   ├── core/
│   │   ├── config.py            # Pydantic settings (env)
│   │   ├── security.py          # JWT + password hashing
│   │   └── deps.py              # Auth/role dependencies
│   ├── db/
│   │   ├── base.py              # Declarative base
│   │   └── session.py           # Engine + SessionLocal
│   ├── models/                  # SQLAlchemy models
│   │   ├── user.py
│   │   ├── endpoint.py
│   │   ├── alert.py
│   │   └── event.py
│   ├── schemas/                 # Pydantic schemas
│   ├── api/                     # REST routers
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── endpoints.py
│   │   ├── alerts.py
│   │   ├── events.py
│   │   ├── threat_intel.py
│   │   └── dashboard.py
│   ├── services/
│   │   ├── simulator.py         # Background SOC event simulator
│   │   └── threat_intel.py      # IOC lookup helpers
│   └── websockets/manager.py    # Connection manager / broadcaster
├── alembic/                     # Migrations
├── agent/sentinelx_agent.py     # Windows endpoint agent
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
├── .env.example
└── README.md
```

## Quick Start (Docker)

```bash
cp .env.example .env
docker compose up --build
# API:        http://localhost:8000
# Swagger:    http://localhost:8000/docs
# ReDoc:      http://localhost:8000/redoc
```

The first boot runs Alembic migrations and seeds an admin
(`admin` / `ChangeMe!123`).

## Quick Start (Local)

```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                # edit DATABASE_URL
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

## Auth

```bash
# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"ChangeMe!123"}'
# → { "access_token": "...", "token_type": "bearer" }
```

Use `Authorization: Bearer <token>` for protected routes.
Roles: `admin` (full access), `analyst` (read + alert triage).

## Core Endpoints

| Method | Path                              | Role            |
| ------ | --------------------------------- | --------------- |
| POST   | /api/auth/login                   | public          |
| POST   | /api/auth/register                | admin           |
| GET    | /api/users                        | admin           |
| GET    | /api/endpoints                    | analyst+        |
| POST   | /api/endpoints/register           | agent (api key) |
| POST   | /api/endpoints/{id}/heartbeat     | agent (api key) |
| GET    | /api/alerts                       | analyst+        |
| PATCH  | /api/alerts/{id}                  | analyst+        |
| GET    | /api/events                       | analyst+        |
| POST   | /api/events                       | agent (api key) |
| GET    | /api/threat-intel/lookup/{ioc}    | analyst+        |
| GET    | /api/dashboard/stats              | analyst+        |
| WS     | /ws/dashboard?token=<jwt>         | analyst+        |

## WebSocket

Connect: `ws://localhost:8000/ws/dashboard?token=<JWT>`

Server pushes JSON frames:

```json
{ "type": "alert.created", "data": { ... } }
{ "type": "event.created", "data": { ... } }
{ "type": "endpoint.status", "data": { "id": 1, "status": "offline" } }
```

## Windows Endpoint Agent

```powershell
cd agent
pip install -r requirements.txt
set SENTINELX_API_URL=http://your-soc:8000
set SENTINELX_API_KEY=<agent_key from .env>
python sentinelx_agent.py
```

Install as a service with NSSM:

```powershell
nssm install SentinelX "C:\Python311\python.exe" "C:\sentinelx\sentinelx_agent.py"
```

## Environment Variables

See `.env.example`. Required:

- `DATABASE_URL`  - postgresql+psycopg://user:pass@host:5432/sentinelx
- `JWT_SECRET`    - long random string
- `JWT_EXPIRES_MINUTES` - default 60
- `AGENT_API_KEY` - shared secret for endpoint agents
- `SIMULATOR_ENABLED` - `true` to generate demo SOC events
- `CORS_ORIGINS`  - comma-separated origin list

## Migrations

```bash
alembic revision --autogenerate -m "describe change"
alembic upgrade head
alembic downgrade -1
```

## Testing the API

```bash
# Stats
TOKEN=$(curl -s -X POST localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"ChangeMe!123"}' | jq -r .access_token)
curl -H "Authorization: Bearer $TOKEN" localhost:8000/api/dashboard/stats
```

## Production Notes

- Set a strong `JWT_SECRET` and rotate `AGENT_API_KEY` per deployment.
- Run behind TLS (nginx / Caddy / Cloudflare).
- Disable `SIMULATOR_ENABLED` in production.
- Set `CORS_ORIGINS` to the dashboard origin only.
- Use a managed Postgres with backups; pin pool size via `DB_POOL_SIZE`.
