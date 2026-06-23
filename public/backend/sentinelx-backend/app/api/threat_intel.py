"""Lightweight threat-intel lookup. Replace with VirusTotal / AbuseIPDB in prod."""
from fastapi import APIRouter, Depends
import hashlib

from ..core.deps import get_current_user

router = APIRouter(prefix="/api/threat-intel", tags=["threat-intel"], dependencies=[Depends(get_current_user)])

_BLOCKLIST = {
    "1.2.3.4": {"category": "C2", "confidence": 95, "source": "internal"},
    "evil.example.com": {"category": "phishing", "confidence": 88, "source": "internal"},
}


@router.get("/lookup/{ioc}")
def lookup(ioc: str):
    if ioc in _BLOCKLIST:
        return {"ioc": ioc, "match": True, **_BLOCKLIST[ioc]}
    # Deterministic pseudo-score for unknown IOCs (demo)
    score = int(hashlib.sha256(ioc.encode()).hexdigest(), 16) % 100
    return {
        "ioc": ioc,
        "match": False,
        "category": "unknown",
        "confidence": score,
        "source": "heuristic",
    }
