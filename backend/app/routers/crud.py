"""Generic, policy-checked REST API:  /api/{collection}[/{id}[/{sub}[/{subId}]]"""
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from pymongo.errors import DuplicateKeyError

from ..db import col
from ..deps import current_user, uid
from ..hub import hub
from ..notify import notify
from ..policy import REGISTRY, Resource, SubResource
from ..serialize import check_field, doc_out, now, oid, parse_dates

router = APIRouter(prefix="/api", tags=["resources"])

RESERVED = {"sort", "limit", "skip", "count"}
BLOCKED_FILTER_FIELDS = {"passwordHash", "resetTokenHash", "resetExpires", "email"}


def resource(name: str) -> Resource:
    r = REGISTRY.get(name)
    if not r:
        raise HTTPException(404, "Unknown collection")
    return r


def sub_resource(r: Resource, name: str) -> SubResource:
    s = r.subs.get(name)
    if not s:
        raise HTTPException(404, "Unknown sub-collection")
    return s


def coerce(value: str):
    if value in ("true", "false"):
        return value == "true"
    return value


def build_filter(params: dict[str, str], scope: dict) -> dict:
    flt: dict = {}
    for key, raw in params.items():
        if key in RESERVED:
            continue
        field, _, op = key.partition("__")
        check_field(field)
        if field in BLOCKED_FILTER_FIELDS or field.startswith("$"):
            raise HTTPException(422, f"Cannot filter on {field}")
        mfield = "_id" if field == "id" else field
        parse_one = (lambda v: oid(v)) if mfield == "_id" else coerce
        if op == "in":
            flt[mfield] = {"$in": [parse_one(v) for v in raw.split(",") if v]}
        elif op == "has":
            flt[mfield] = coerce(raw)
        elif op == "":
            flt[mfield] = parse_one(raw)
        else:
            raise HTTPException(422, f"Unknown operator {op}")
    return {"$and": [flt, scope]} if scope and flt else (scope or flt)


def sort_spec(sort: str | None, default: str):
    s = sort or default
    field = check_field(s.lstrip("-"))
    return [("_id" if field == "id" else field, -1 if s.startswith("-") else 1)]


async def get_or_404(coll: str, id_: str) -> dict:
    doc = await col(coll).find_one({"_id": oid(id_)})
    if not doc:
        raise HTTPException(404, "Not found")
    return doc


# ------------------------------------------------------------------ collection level
@router.get("/{coll}")
async def list_docs(coll: str, request: Request, sort: str | None = None, limit: int = Query(200, ge=1, le=500),
                    skip: int = Query(0, ge=0), count: bool = False, user: dict = Depends(current_user)):
    r = resource(coll)
    scope = r.list_scope(user)
    if scope is None:
        raise HTTPException(403, "Forbidden")
    flt = build_filter(dict(request.query_params), scope)
    if count:
        return {"count": await col(coll).count_documents(flt)}
    cursor = col(coll).find(flt).sort(sort_spec(sort, r.default_sort)).skip(skip).limit(limit)
    return [doc_out(r.clean(user, d)) async for d in cursor]


@router.post("/{coll}", status_code=201)
async def create_doc(coll: str, body: dict = Body(...), user: dict = Depends(current_user)):
    r = resource(coll)
    data = await r.prepare_create(user, parse_dates(body))
    try:
        res = await col(coll).insert_one(data)
    except DuplicateKeyError:
        raise HTTPException(409, "Already exists")
    created = {**data, "_id": res.inserted_id}
    await r.after_create(user, created)
    await hub.publish(coll)
    return doc_out(r.clean(user, created))


@router.get("/{coll}/{id_}")
async def get_doc(coll: str, id_: str, user: dict = Depends(current_user)):
    r = resource(coll)
    doc = await get_or_404(coll, id_)
    if not r.can_read(user, doc):
        raise HTTPException(403, "Forbidden")
    return doc_out(r.clean(user, doc))


@router.patch("/{coll}/{id_}")
async def update_doc(coll: str, id_: str, body: dict = Body(...), user: dict = Depends(current_user)):
    r = resource(coll)
    doc = await get_or_404(coll, id_)
    if not r.can_read(user, doc):
        raise HTTPException(403, "Forbidden")
    ops = parse_dates(body.pop("$ops", {}) or {})
    sets = parse_dates(body)

    allowed_sets, allowed_ops = r.set_fields(user, doc), r.op_fields(user, doc)
    for key in sets:
        check_field(key)
        if key.split(".")[0] not in allowed_sets:
            raise HTTPException(403, f"You cannot modify '{key}'")
    update: dict = {}
    for op, mongo_op in (("addToSet", "$addToSet"), ("pull", "$pull")):
        for key, value in (ops.get(op) or {}).items():
            if key not in allowed_ops:
                raise HTTPException(403, f"You cannot modify '{key}'")
            update.setdefault(mongo_op, {})[key] = value
    if not sets and not update:
        raise HTTPException(422, "Nothing to update")

    await r.before_update(user, doc, sets, ops)
    if sets:
        update["$set"] = sets
    await col(coll).update_one({"_id": doc["_id"]}, update)
    fresh = await col(coll).find_one({"_id": doc["_id"]})
    await r.after_update(user, doc, fresh)
    await hub.publish(coll, f"{coll}/{id_}")
    return doc_out(r.clean(user, fresh))


@router.delete("/{coll}/{id_}", status_code=204)
async def delete_doc(coll: str, id_: str, user: dict = Depends(current_user)):
    r = resource(coll)
    doc = await get_or_404(coll, id_)
    if not r.can_read(user, doc) or not r.can_delete(user, doc):
        raise HTTPException(403, "Forbidden")
    await col(coll).delete_one({"_id": doc["_id"]})
    for sub in r.subs:
        await col(f"{coll}_{sub}").delete_many({"parentId": id_})
    await r.after_delete(doc)
    await hub.publish(coll, f"{coll}/{id_}")


# ------------------------------------------------------------------ sub-collections
async def parent_for(coll: str, id_: str, user: dict) -> tuple[Resource, dict]:
    r = resource(coll)
    parent = await get_or_404(coll, id_)
    if not r.can_read(user, parent):
        raise HTTPException(403, "Forbidden")
    return r, parent


@router.get("/{coll}/{id_}/{sub}")
async def list_sub(coll: str, id_: str, sub: str, user: dict = Depends(current_user)):
    r, parent = await parent_for(coll, id_, user)
    s = sub_resource(r, sub)
    scope = s.can_list(user, parent)
    if scope is None:
        raise HTTPException(403, "Forbidden")
    flt = {"$and": [{"parentId": id_}, scope]} if scope else {"parentId": id_}
    cursor = col(f"{coll}_{sub}").find(flt).sort(s.sort_field, 1)
    return [doc_out(d) async for d in cursor]


@router.post("/{coll}/{id_}/{sub}", status_code=201)
async def create_sub(coll: str, id_: str, sub: str, body: dict = Body(...), user: dict = Depends(current_user)):
    r, parent = await parent_for(coll, id_, user)
    s = sub_resource(r, sub)
    data = await s.prepare_create(user, parent, parse_dates(body))
    data.setdefault(s.sort_field, now())
    data.setdefault("createdAt", now())
    data["parentId"] = id_
    res = await col(f"{coll}_{sub}").insert_one(data)
    if coll == "chats":
        await col("chats").update_one({"_id": parent["_id"]}, {"$set": {
            "lastMessage": {"text": data["text"], "senderId": data["senderId"]}, "updatedAt": now()}})
        await hub.publish("chats")
        others = [p for p in parent["participants"] if p != uid(user)]
        await notify(others, "message", f"New message from {user.get('displayName', 'someone')}", data["text"][:80], f"/chat/{id_}", collapse=True)
    await hub.publish(f"{coll}/{id_}/{sub}")
    return doc_out({**data, "_id": res.inserted_id})


@router.get("/{coll}/{id_}/{sub}/{sub_id}")
async def get_sub(coll: str, id_: str, sub: str, sub_id: str, user: dict = Depends(current_user)):
    r, parent = await parent_for(coll, id_, user)
    s = sub_resource(r, sub)
    doc = await col(f"{coll}_{sub}").find_one({"_id": oid(sub_id), "parentId": id_})
    scope = s.can_list(user, parent)
    if not doc or scope is None:
        raise HTTPException(404, "Not found")
    return doc_out(doc)


@router.patch("/{coll}/{id_}/{sub}/{sub_id}")
async def update_sub(coll: str, id_: str, sub: str, sub_id: str, body: dict = Body(...), user: dict = Depends(current_user)):
    r, parent = await parent_for(coll, id_, user)
    s = sub_resource(r, sub)
    doc = await col(f"{coll}_{sub}").find_one({"_id": oid(sub_id), "parentId": id_})
    if not doc:
        raise HTTPException(404, "Not found")
    allowed = s.set_fields(user, parent, doc)
    sets = parse_dates(body)
    for key in sets:
        check_field(key)
        if key not in allowed:
            raise HTTPException(403, f"You cannot modify '{key}'")
    if not sets:
        raise HTTPException(422, "Nothing to update")
    await col(f"{coll}_{sub}").update_one({"_id": doc["_id"]}, {"$set": sets})
    await hub.publish(f"{coll}/{id_}/{sub}")
    return doc_out(await col(f"{coll}_{sub}").find_one({"_id": doc["_id"]}))


@router.delete("/{coll}/{id_}/{sub}/{sub_id}", status_code=204)
async def delete_sub(coll: str, id_: str, sub: str, sub_id: str, user: dict = Depends(current_user)):
    r, parent = await parent_for(coll, id_, user)
    s = sub_resource(r, sub)
    doc = await col(f"{coll}_{sub}").find_one({"_id": oid(sub_id), "parentId": id_})
    if not doc:
        raise HTTPException(404, "Not found")
    if not s.can_write(user, parent, doc):
        raise HTTPException(403, "Forbidden")
    await col(f"{coll}_{sub}").delete_one({"_id": doc["_id"]})
    await hub.publish(f"{coll}/{id_}/{sub}")
