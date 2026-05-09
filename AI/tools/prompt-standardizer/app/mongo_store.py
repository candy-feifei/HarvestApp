"""MongoDB access for AI sessions, project knowledge base, and strategy snapshots."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import MongoClient
from pymongo.database import Database

from app.config import settings

_client: MongoClient | None = None


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def get_mongo_database() -> Database | None:
    global _client
    uri = (settings.mongo_uri or "").strip()
    if not uri:
        return None
    if _client is None:
        _client = MongoClient(uri, serverSelectionTimeoutMS=8000)
    return _client[settings.mongo_db]


def require_mongo() -> Database:
    db = get_mongo_database()
    if db is None:
        raise RuntimeError("MongoDB is not configured (empty PROMPT_STD_MONGO_URI).")
    db.command("ping")
    return db


def ensure_mongo_indexes() -> None:
    db = get_mongo_database()
    if db is None:
        return
    db["ai_chat_sessions"].create_index([("project_id", 1), ("updated_at", -1)])
    db["ai_chat_sessions"].create_index([("updated_at", -1)])
    db["project_kb"].create_index([("project_id", 1), ("updated_at", -1)])
    db["project_strategies"].create_index([("project_id", 1), ("created_at", -1)])
    db["md_documents"].create_index([("project_id", 1), ("updated_at", -1)])
    db["md_versions"].create_index([("document_id", 1), ("version", -1)])


def oid_str(oid: ObjectId | str) -> str:
    return str(oid) if isinstance(oid, ObjectId) else oid


def parse_oid(s: str) -> ObjectId:
    try:
        return ObjectId(s)
    except InvalidId as e:
        raise ValueError("invalid id") from e


# --- AI chat sessions ---


def ai_session_create(
    db: Database,
    *,
    project_id: int | None,
    template_id: int | None,
    provider: str,
    model: str = "pending",
) -> str:
    now = _utc_now()
    doc: dict[str, Any] = {
        "project_id": project_id,
        "template_id": template_id,
        "provider": provider,
        "model": model,
        "system_preamble": None,
        "messages": [],
        "created_at": now,
        "updated_at": now,
    }
    res = db["ai_chat_sessions"].insert_one(doc)
    return str(res.inserted_id)


def ai_session_set_system_preamble(db: Database, session_id: str, text: str) -> None:
    oid = parse_oid(session_id)
    db["ai_chat_sessions"].update_one(
        {"_id": oid},
        {"$set": {"system_preamble": text, "updated_at": _utc_now()}},
    )


def ai_session_append_message(db: Database, session_id: str, role: str, content: str) -> None:
    oid = parse_oid(session_id)
    now = _utc_now()
    db["ai_chat_sessions"].update_one(
        {"_id": oid},
        {
            "$push": {"messages": {"role": role, "content": content, "at": now}},
            "$set": {"updated_at": now},
        },
    )


def ai_session_get(db: Database, session_id: str) -> dict[str, Any] | None:
    oid = parse_oid(session_id)
    doc = db["ai_chat_sessions"].find_one({"_id": oid})
    if not doc:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc


def ai_session_delete(db: Database, session_id: str) -> bool:
    oid = parse_oid(session_id)
    r = db["ai_chat_sessions"].delete_one({"_id": oid})
    return r.deleted_count > 0


def ai_session_list(db: Database, *, project_id: int | None, limit: int = 80) -> list[dict[str, Any]]:
    q: dict[str, Any] = {}
    if project_id is not None:
        q["project_id"] = project_id
    cur = db["ai_chat_sessions"].find(q).sort("updated_at", -1).limit(limit)
    out = []
    for doc in cur:
        doc = dict(doc)
        doc["id"] = str(doc.pop("_id"))
        out.append(doc)
    return out


# --- Project knowledge base ---


def kb_insert(db: Database, *, project_id: int, title: str, content: str) -> str:
    now = _utc_now()
    doc = {"project_id": project_id, "title": title, "content": content, "created_at": now, "updated_at": now}
    res = db["project_kb"].insert_one(doc)
    return str(res.inserted_id)


def kb_update(db: Database, kb_id: str, *, title: str | None, content: str | None) -> bool:
    oid = parse_oid(kb_id)
    patch: dict[str, Any] = {"updated_at": _utc_now()}
    if title is not None:
        patch["title"] = title
    if content is not None:
        patch["content"] = content
    r = db["project_kb"].update_one({"_id": oid}, {"$set": patch})
    return r.matched_count > 0


def kb_delete(db: Database, kb_id: str) -> bool:
    oid = parse_oid(kb_id)
    r = db["project_kb"].delete_one({"_id": oid})
    return r.deleted_count > 0


def kb_list(db: Database, project_id: int) -> list[dict[str, Any]]:
    cur = db["project_kb"].find({"project_id": project_id}).sort("updated_at", -1)
    out = []
    for doc in cur:
        doc = dict(doc)
        doc["id"] = str(doc.pop("_id"))
        out.append(doc)
    return out


def kb_get(db: Database, kb_id: str) -> dict[str, Any] | None:
    oid = parse_oid(kb_id)
    doc = db["project_kb"].find_one({"_id": oid})
    if not doc:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc


# --- Strategy history ---


def strategy_insert(db: Database, *, project_id: int, content: str, provider: str, model: str) -> str:
    now = _utc_now()
    doc = {
        "project_id": project_id,
        "content": content,
        "provider": provider,
        "model": model,
        "created_at": now,
    }
    res = db["project_strategies"].insert_one(doc)
    return str(res.inserted_id)


def strategy_list(db: Database, project_id: int, limit: int = 20) -> list[dict[str, Any]]:
    cur = db["project_strategies"].find({"project_id": project_id}).sort("created_at", -1).limit(limit)
    out = []
    for doc in cur:
        doc = dict(doc)
        doc["id"] = str(doc.pop("_id"))
        out.append(doc)
    return out


# --- Versioned Markdown documents (per project) ---


def md_doc_create(db: Database, *, project_id: int, title: str, initial_markdown: str, source: str = "manual") -> str:
    now = _utc_now()
    parent = {"project_id": project_id, "title": title, "created_at": now, "updated_at": now, "latest_version": 1}
    res = db["md_documents"].insert_one(parent)
    did = res.inserted_id
    db["md_versions"].insert_one(
        {
            "document_id": did,
            "version": 1,
            "content": initial_markdown,
            "note": source,
            "created_at": now,
            "ai_session_id": None,
            "source": source,
        }
    )
    return str(did)


def md_doc_get(db: Database, doc_id: str) -> dict[str, Any] | None:
    oid = parse_oid(doc_id)
    doc = db["md_documents"].find_one({"_id": oid})
    if not doc:
        return None
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    return doc


def md_doc_list(db: Database, project_id: int) -> list[dict[str, Any]]:
    cur = db["md_documents"].find({"project_id": project_id}).sort("updated_at", -1)
    out = []
    for doc in cur:
        doc = dict(doc)
        doc["id"] = str(doc.pop("_id"))
        out.append(doc)
    return out


def md_doc_update(db: Database, doc_id: str, *, title: str | None) -> bool:
    oid = parse_oid(doc_id)
    patch: dict[str, Any] = {"updated_at": _utc_now()}
    if title is not None:
        patch["title"] = title
    r = db["md_documents"].update_one({"_id": oid}, {"$set": patch})
    return r.matched_count > 0


def md_doc_delete(db: Database, doc_id: str) -> bool:
    oid = parse_oid(doc_id)
    db["md_versions"].delete_many({"document_id": oid})
    r = db["md_documents"].delete_one({"_id": oid})
    return r.deleted_count > 0


def md_get_version_row(db: Database, doc_id: str, version: int | None) -> dict[str, Any] | None:
    oid = parse_oid(doc_id)
    if version is None:
        cur = db["md_versions"].find({"document_id": oid}).sort("version", -1).limit(1)
    else:
        cur = db["md_versions"].find({"document_id": oid, "version": version}).limit(1)
    row = next(cur, None)
    if not row:
        return None
    row = dict(row)
    row.pop("_id", None)
    if "document_id" in row:
        row["document_id"] = str(row["document_id"])
    return row


def md_version_list_meta(db: Database, doc_id: str, limit: int = 50) -> list[dict[str, Any]]:
    oid = parse_oid(doc_id)
    cur = db["md_versions"].find({"document_id": oid}, {"content": 0}).sort("version", -1).limit(limit)
    out = []
    for row in cur:
        row = dict(row)
        row.pop("_id", None)
        if "document_id" in row:
            row["document_id"] = str(row["document_id"])
        out.append(row)
    return out


def md_version_append(
    db: Database,
    doc_id: str,
    *,
    content: str,
    note: str | None,
    source: str,
    ai_session_id: str | None = None,
) -> int:
    oid = parse_oid(doc_id)
    last = db["md_versions"].find_one({"document_id": oid}, sort=[("version", -1)])
    next_v = (last["version"] + 1) if last else 1
    now = _utc_now()
    db["md_versions"].insert_one(
        {
            "document_id": oid,
            "version": next_v,
            "content": content,
            "note": note or "",
            "created_at": now,
            "ai_session_id": ai_session_id,
            "source": source,
        }
    )
    db["md_documents"].update_one({"_id": oid}, {"$set": {"updated_at": now, "latest_version": next_v}})
    return next_v
