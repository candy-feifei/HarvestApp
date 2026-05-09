from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.deps import mongo_db_dep
from app.llm_providers import (
    ProviderName,
    chat_completion,
    default_model_for,
    iter_chat_completion_stream,
    request_preview,
    list_available_providers,
    provider_configured,
)
from app.metrics import render_template
from app.mongo_store import (
    ai_session_append_message,
    ai_session_create,
    ai_session_delete,
    ai_session_get,
    ai_session_list,
    ai_session_set_system_preamble,
    md_doc_get,
    md_doc_list,
    md_get_version_row,
)
from pymongo.database import Database

from app.schemas import AIChatRequest

router = APIRouter(prefix="/api/ai", tags=["ai"])


def _session_json_ready(doc: dict[str, Any]) -> dict[str, Any]:
    def fix_dt(x: Any) -> Any:
        if isinstance(x, datetime):
            return x.isoformat()
        return x

    out = dict(doc)
    for k in ("created_at", "updated_at"):
        if k in out:
            out[k] = fix_dt(out[k])
    msgs = []
    for m in out.get("messages") or []:
        mm = dict(m)
        if "at" in mm:
            mm["at"] = fix_dt(mm["at"])
        msgs.append(mm)
    out["messages"] = msgs
    return out


def _openai_messages_from_stored(stored: list[dict[str, Any]]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for m in stored:
        role = m.get("role")
        content = m.get("content")
        if role in ("user", "assistant") and isinstance(content, str):
            out.append({"role": role, "content": content})
    return out


def _inject_linked_markdown(
    mdb: Database,
    openai_msgs: list[dict[str, str]],
    *,
    project_id: int | None,
    linked_markdown_document_id: str | None,
) -> None:
    if not project_id:
        return

    docs_blob = ""
    if linked_markdown_document_id:
        md_doc = md_doc_get(mdb, linked_markdown_document_id)
        if not md_doc or md_doc.get("project_id") != project_id:
            raise HTTPException(status_code=400, detail="Markdown document not found for this project.")
        row = md_get_version_row(mdb, linked_markdown_document_id, None)
        if not row:
            raise HTTPException(status_code=400, detail="Markdown document has no versions.")
        body = row.get("content") or ""
        docs_blob = f"### {md_doc.get('title') or 'Document'}\n\n{body}\n"
    else:
        # 9.9: If a project is selected, use its living Markdown documents as baseline knowledge.
        # We inject the latest versions of up to N docs (small cap) to avoid runaway prompts.
        rows = md_doc_list(mdb, project_id)
        max_docs = 3
        max_chars_total = 16000
        parts: list[str] = []
        used = 0
        for d in rows[:max_docs]:
            did = d.get("id")
            if not isinstance(did, str):
                continue
            vr = md_get_version_row(mdb, did, None)
            if not vr:
                continue
            content = (vr.get("content") or "").strip()
            if not content:
                continue
            title = d.get("title") or "Document"
            block = f"### {title}\n\n{content}\n"
            if used + len(block) > max_chars_total:
                block = block[: max(0, max_chars_total - used)] + "\n...[truncated]"
            parts.append(block)
            used += len(block)
            if used >= max_chars_total:
                break
        docs_blob = "\n".join(parts)

    if not docs_blob.strip():
        return

    block = (
        "Project living Markdown knowledge (latest versions). The user may only want casual chat; "
        "do not force edits. If they request updates, you may return a full revised Markdown document "
        "inside a single ```markdown fenced block.\n\n-----\n\n"
        + docs_blob
    )
    insert_at = 1 if len(openai_msgs) >= 1 else 0
    openai_msgs.insert(insert_at, {"role": "system", "content": block})


def _prepare_openai_messages(
    db: Session,
    mdb: Database,
    payload: AIChatRequest,
    session_id: str,
) -> list[dict[str, str]]:
    doc = ai_session_get(mdb, session_id)
    if not doc:
        raise HTTPException(status_code=404, detail="AI session not found")
    stored_messages: list[dict[str, Any]] = doc.get("messages") or []
    openai_msgs: list[dict[str, str]] = []

    preamble = doc.get("system_preamble")
    if isinstance(preamble, str) and preamble.strip():
        openai_msgs.append({"role": "system", "content": preamble})
    elif not stored_messages:
        if payload.template_id is not None:
            tpl = db.get(models.PromptTemplate, payload.template_id)
            if not tpl:
                raise HTTPException(status_code=400, detail="Template not found")
            rendered = render_template(tpl.body, payload.template_variables)
            openai_msgs.append({"role": "system", "content": rendered})
            ai_session_set_system_preamble(mdb, session_id, rendered)
        else:
            default_sys = "You are a helpful assistant. Follow user instructions carefully."
            openai_msgs.append({"role": "system", "content": default_sys})
            ai_session_set_system_preamble(mdb, session_id, default_sys)

    _inject_linked_markdown(
        mdb,
        openai_msgs,
        project_id=payload.project_id,
        linked_markdown_document_id=payload.linked_markdown_document_id,
    )

    openai_msgs.extend(_openai_messages_from_stored(stored_messages))
    openai_msgs.append({"role": "user", "content": payload.message})
    return openai_msgs


@router.get("/providers")
def providers_status():
    return {"providers": list_available_providers()}


@router.get("/sessions")
def list_ai_sessions(
    project_id: int | None = Query(default=None),
    limit: int = Query(80, ge=1, le=200),
    mdb=Depends(mongo_db_dep),
):
    return ai_session_list(mdb, project_id=project_id, limit=limit)


@router.get("/sessions/{session_id}")
def get_ai_session(session_id: str, mdb=Depends(mongo_db_dep)):
    doc = ai_session_get(mdb, session_id)
    if not doc:
        raise HTTPException(status_code=404, detail="AI session not found")
    return doc


@router.delete("/sessions/{session_id}")
def delete_ai_session(session_id: str, mdb=Depends(mongo_db_dep)):
    if not ai_session_delete(mdb, session_id):
        raise HTTPException(status_code=404, detail="AI session not found")
    return {"ok": True}


@router.post("/chat")
def ai_chat(payload: AIChatRequest, db: Session = Depends(get_db), mdb=Depends(mongo_db_dep)):
    prov: ProviderName = payload.provider
    if not provider_configured(prov):
        raise HTTPException(status_code=400, detail=f"Provider {prov} is not configured.")

    session_id = payload.session_id
    if not session_id:
        session_id = ai_session_create(
            mdb,
            project_id=payload.project_id,
            template_id=payload.template_id,
            provider=prov,
            model=default_model_for(prov),
        )

    openai_msgs = _prepare_openai_messages(db, mdb, payload, session_id)
    req_preview = request_preview(
        prov,
        openai_msgs,
        model_override=payload.model_override,
        stream=False,
    )
    ai_session_append_message(mdb, session_id, "user", payload.message)

    try:
        out = chat_completion(prov, openai_msgs, model_override=payload.model_override)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    assistant_text = out["content"]
    model_used = out["model"]
    mdb["ai_chat_sessions"].update_one({"_id": ObjectId(session_id)}, {"$set": {"model": model_used}})
    ai_session_append_message(mdb, session_id, "assistant", assistant_text)

    doc2 = ai_session_get(mdb, session_id)
    return {
        "session_id": session_id,
        "assistant": assistant_text,
        "model": model_used,
        "session": doc2,
        "request_preview": req_preview,
    }


@router.post("/chat/stream")
def ai_chat_stream(payload: AIChatRequest, db: Session = Depends(get_db), mdb=Depends(mongo_db_dep)):
    prov: ProviderName = payload.provider
    if not provider_configured(prov):
        raise HTTPException(status_code=400, detail=f"Provider {prov} is not configured.")

    session_id = payload.session_id
    if not session_id:
        session_id = ai_session_create(
            mdb,
            project_id=payload.project_id,
            template_id=payload.template_id,
            provider=prov,
            model=default_model_for(prov),
        )

    openai_msgs = _prepare_openai_messages(db, mdb, payload, session_id)
    req_preview = request_preview(
        prov,
        openai_msgs,
        model_override=payload.model_override,
        stream=True,
    )
    ai_session_append_message(mdb, session_id, "user", payload.message)

    def event_gen():
        buf: list[str] = []
        model_used = default_model_for(prov)
        try:
            yield f"data: {json.dumps({'request_preview': req_preview})}\n\n"
            for piece, mpart in iter_chat_completion_stream(
                prov, openai_msgs, model_override=payload.model_override
            ):
                if mpart:
                    model_used = mpart
                buf.append(piece)
                yield f"data: {json.dumps({'delta': piece})}\n\n"
            assistant_text = "".join(buf)
            mdb["ai_chat_sessions"].update_one({"_id": ObjectId(session_id)}, {"$set": {"model": model_used}})
            ai_session_append_message(mdb, session_id, "assistant", assistant_text)
            doc2 = ai_session_get(mdb, session_id)
            done_payload = {
                "done": True,
                "session_id": session_id,
                "model": model_used,
                "session": _session_json_ready(doc2) if doc2 else None,
            }
            yield f"data: {json.dumps(done_payload)}\n\n"
        except Exception as exc:  # noqa: BLE001
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream")
