"""JSON <-> Mongo conversion helpers (ObjectId, datetimes)."""
import re
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import HTTPException

ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$")
FIELD_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)*$")


def to_json(v: Any) -> Any:
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, datetime):
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        return v.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    if isinstance(v, dict):
        return {k: to_json(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [to_json(x) for x in v]
    return v


def doc_out(d: dict | None) -> dict | None:
    if d is None:
        return None
    out = to_json(d)
    out["id"] = out.pop("_id")
    return out


def parse_dates(v: Any) -> Any:
    """Convert ISO-8601 strings sent by the client into datetimes before storing."""
    if isinstance(v, str) and ISO_RE.match(v):
        return datetime.fromisoformat(v.replace("Z", "+00:00"))
    if isinstance(v, dict):
        return {k: parse_dates(x) for k, x in v.items()}
    if isinstance(v, list):
        return [parse_dates(x) for x in v]
    return v


def oid(value: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(404, "Not found")
    return ObjectId(value)


def check_field(name: str) -> str:
    if not FIELD_RE.match(name):
        raise HTTPException(422, f"Invalid field name: {name}")
    return name


def now() -> datetime:
    return datetime.now(timezone.utc)
