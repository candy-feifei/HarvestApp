from __future__ import annotations

import json

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app import models
from app.database import get_db
from app.deps import mongo_db_dep
from app.matching import PersonCardView, RoleSkillView, evaluate_persons_for_task_skills
from app.role_engine_config import load_role_engine_settings
from app.llm_providers import ProviderName, chat_completion, provider_configured
from app.metrics import render_template
from app.mongo_store import (
    kb_delete,
    kb_get,
    kb_insert,
    kb_list,
    kb_update,
    md_doc_create,
    md_doc_delete,
    md_doc_get,
    md_doc_list,
    md_doc_update,
    md_get_version_row,
    md_version_append,
    md_version_list_meta,
    strategy_insert,
    strategy_list,
)
from app.schemas import (
    GenerateStrategyRequest,
    MarkdownDocCreate,
    MarkdownDocUpdate,
    MarkdownVersionCreate,
    ProjectAgentLinkCreate,
    ProjectAgentLinkRead,
    ProjectCreate,
    ProjectKbCreate,
    ProjectKbRead,
    ProjectKbUpdate,
    ProjectMemberCreate,
    ProjectMemberRead,
    ProjectRead,
    ProjectTaskCreate,
    ProjectTaskMatchRequest,
    ProjectTaskRead,
    ProjectTaskUpdate,
    ProjectUpdate,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _get_project(db: Session, project_id: int) -> models.Project:
    row = db.get(models.Project, project_id)
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    return row


def _parse_task_skills(raw: str | None) -> list[str]:
    try:
        data = json.loads(raw or "[]")
        if isinstance(data, list):
            return [str(x).strip() for x in data if str(x).strip()]
    except Exception:
        pass
    return []


def _task_to_read(t: models.ProjectTask) -> ProjectTaskRead:
    return ProjectTaskRead(
        id=t.id,
        project_id=t.project_id,
        title=t.title,
        description=t.description,
        required_skills=_parse_task_skills(t.required_skills_json),
        suggested_template_id=t.suggested_template_id,
        assigned_role_card_id=t.assigned_role_card_id,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


def _member_to_read(db: Session, m: models.ProjectMember) -> ProjectMemberRead:
    rc = db.get(models.RoleCard, m.role_card_id)
    return ProjectMemberRead(
        id=m.id,
        project_id=m.project_id,
        role_card_id=m.role_card_id,
        coordination_role=m.coordination_role,
        notes=m.notes,
        role_display_name=rc.display_name if rc else None,
    )


@router.get("", response_model=list[ProjectRead])
def list_projects(db: Session = Depends(get_db)):
    rows = db.query(models.Project).order_by(models.Project.id.desc()).limit(200).all()
    return rows


@router.post("", response_model=ProjectRead)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    row = models.Project(
        name=payload.name,
        description=payload.description,
        goals_text=payload.goals_text,
        purpose_text=payload.purpose_text,
        working_details_text=payload.working_details_text,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: int, db: Session = Depends(get_db)):
    return _get_project(db, project_id)


@router.put("/{project_id}", response_model=ProjectRead)
def update_project(project_id: int, payload: ProjectUpdate, db: Session = Depends(get_db)):
    row = _get_project(db, project_id)
    if payload.name is not None:
        row.name = payload.name
    if payload.description is not None:
        row.description = payload.description
    if payload.goals_text is not None:
        row.goals_text = payload.goals_text
    if payload.purpose_text is not None:
        row.purpose_text = payload.purpose_text
    if payload.working_details_text is not None:
        row.working_details_text = payload.working_details_text
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    row = _get_project(db, project_id)
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.get("/{project_id}/members", response_model=list[ProjectMemberRead])
def list_members(project_id: int, db: Session = Depends(get_db)):
    _get_project(db, project_id)
    rows = db.query(models.ProjectMember).filter_by(project_id=project_id).order_by(models.ProjectMember.id.asc()).all()
    return [_member_to_read(db, m) for m in rows]


@router.post("/{project_id}/members", response_model=ProjectMemberRead)
def add_member(project_id: int, payload: ProjectMemberCreate, db: Session = Depends(get_db)):
    _get_project(db, project_id)
    if not db.get(models.RoleCard, payload.role_card_id):
        raise HTTPException(status_code=400, detail="Role card not found")
    m = models.ProjectMember(
        project_id=project_id,
        role_card_id=payload.role_card_id,
        coordination_role=payload.coordination_role,
        notes=payload.notes,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return _member_to_read(db, m)


@router.get("/{project_id}/tasks", response_model=list[ProjectTaskRead])
def list_tasks(project_id: int, db: Session = Depends(get_db)):
    _get_project(db, project_id)
    rows = (
        db.query(models.ProjectTask)
        .filter_by(project_id=project_id)
        .order_by(models.ProjectTask.id.asc())
        .all()
    )
    return [_task_to_read(t) for t in rows]


@router.post("/{project_id}/tasks", response_model=ProjectTaskRead)
def create_task(project_id: int, payload: ProjectTaskCreate, db: Session = Depends(get_db)):
    _get_project(db, project_id)
    if payload.suggested_template_id is not None and not db.get(
        models.PromptTemplate, payload.suggested_template_id
    ):
        raise HTTPException(status_code=400, detail="Suggested agent template not found")
    if payload.assigned_role_card_id is not None and not db.get(models.RoleCard, payload.assigned_role_card_id):
        raise HTTPException(status_code=400, detail="Assigned person not found")
    row = models.ProjectTask(
        project_id=project_id,
        title=payload.title,
        description=payload.description,
        required_skills_json=json.dumps(payload.required_skills or [], ensure_ascii=False),
        suggested_template_id=payload.suggested_template_id,
        assigned_role_card_id=payload.assigned_role_card_id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _task_to_read(row)


@router.put("/{project_id}/tasks/{task_id}", response_model=ProjectTaskRead)
def update_task(
    project_id: int,
    task_id: int,
    payload: ProjectTaskUpdate,
    db: Session = Depends(get_db),
):
    _get_project(db, project_id)
    row = db.get(models.ProjectTask, task_id)
    if not row or row.project_id != project_id:
        raise HTTPException(status_code=404, detail="Task not found")
    data = payload.model_dump(exclude_unset=True)
    if "title" in data:
        row.title = data["title"] or row.title
    if "description" in data:
        row.description = data["description"]
    if "required_skills" in data and data["required_skills"] is not None:
        row.required_skills_json = json.dumps(data["required_skills"], ensure_ascii=False)
    if "suggested_template_id" in data:
        sid = data["suggested_template_id"]
        if sid is not None and not db.get(models.PromptTemplate, sid):
            raise HTTPException(status_code=400, detail="Suggested agent template not found")
        row.suggested_template_id = sid
    if "assigned_role_card_id" in data:
        aid = data["assigned_role_card_id"]
        if aid is not None and not db.get(models.RoleCard, aid):
            raise HTTPException(status_code=400, detail="Assigned person not found")
        row.assigned_role_card_id = aid
    db.commit()
    db.refresh(row)
    return _task_to_read(row)


@router.delete("/{project_id}/tasks/{task_id}")
def delete_task(project_id: int, task_id: int, db: Session = Depends(get_db)):
    _get_project(db, project_id)
    row = db.get(models.ProjectTask, task_id)
    if not row or row.project_id != project_id:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.get("/{project_id}/agents", response_model=list[ProjectAgentLinkRead])
def list_project_agents(project_id: int, db: Session = Depends(get_db)):
    _get_project(db, project_id)
    rows = (
        db.query(models.ProjectAgentLink)
        .options(joinedload(models.ProjectAgentLink.template))
        .filter_by(project_id=project_id)
        .order_by(models.ProjectAgentLink.id.asc())
        .all()
    )
    return [
        ProjectAgentLinkRead(
            id=r.id,
            project_id=r.project_id,
            template_id=r.template_id,
            template_name=r.template.name if r.template else None,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("/{project_id}/agents", response_model=ProjectAgentLinkRead)
def link_project_agent(project_id: int, payload: ProjectAgentLinkCreate, db: Session = Depends(get_db)):
    _get_project(db, project_id)
    tpl = db.get(models.PromptTemplate, payload.template_id)
    if not tpl:
        raise HTTPException(status_code=400, detail="Agent template not found")
    dup = (
        db.query(models.ProjectAgentLink)
        .filter_by(project_id=project_id, template_id=payload.template_id)
        .first()
    )
    if dup:
        return ProjectAgentLinkRead(
            id=dup.id,
            project_id=dup.project_id,
            template_id=dup.template_id,
            template_name=tpl.name,
            created_at=dup.created_at,
        )
    row = models.ProjectAgentLink(project_id=project_id, template_id=payload.template_id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return ProjectAgentLinkRead(
        id=row.id,
        project_id=row.project_id,
        template_id=row.template_id,
        template_name=tpl.name,
        created_at=row.created_at,
    )


@router.delete("/{project_id}/agents/{link_id}")
def unlink_project_agent(project_id: int, link_id: int, db: Session = Depends(get_db)):
    _get_project(db, project_id)
    row = db.get(models.ProjectAgentLink, link_id)
    if not row or row.project_id != project_id:
        raise HTTPException(status_code=404, detail="Agent link not found")
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.post("/{project_id}/tasks/{task_id}/match")
def match_task_to_team(
    project_id: int,
    task_id: int,
    body: ProjectTaskMatchRequest | None = Body(None),
    db: Session = Depends(get_db),
):
    """Match task required skills to project members only (Person), rule-based."""
    _get_project(db, project_id)
    task = db.get(models.ProjectTask, task_id)
    if not task or task.project_id != project_id:
        raise HTTPException(status_code=404, detail="Task not found")
    settings = load_role_engine_settings(db)
    eff = settings.enabled if (body is None or body.force_engine is None) else bool(body.force_engine)

    members = (
        db.query(models.ProjectMember)
        .options(joinedload(models.ProjectMember.role_card).joinedload(models.RoleCard.skills))
        .filter_by(project_id=project_id)
        .all()
    )
    persons: list[PersonCardView] = []
    seen: set[int] = set()
    for m in members:
        rc = m.role_card
        if not rc or rc.id in seen:
            continue
        seen.add(rc.id)
        persons.append(
            PersonCardView(
                id=rc.id,
                display_name=rc.display_name,
                notes=rc.notes,
                job_title=rc.job_title,
                team_name=rc.team_name,
                current_load=rc.current_load or 0,
                skills=[RoleSkillView(skill_name=s.skill_name, level=s.level) for s in rc.skills],
            )
        )

    required = _parse_task_skills(task.required_skills_json)
    result = evaluate_persons_for_task_skills(
        required,
        persons,
        settings.allocation_principles,
        eff,
        load_penalty_per_unit=float(settings.load_penalty_per_unit),
    )
    result["task"] = _task_to_read(task).model_dump(mode="json")
    return {"result": result}


@router.delete("/{project_id}/members/{member_id}")
def remove_member(project_id: int, member_id: int, db: Session = Depends(get_db)):
    _get_project(db, project_id)
    m = db.get(models.ProjectMember, member_id)
    if not m or m.project_id != project_id:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(m)
    db.commit()
    return {"ok": True}


@router.get("/{project_id}/kb", response_model=list[ProjectKbRead])
def list_kb(project_id: int, db: Session = Depends(get_db), mdb=Depends(mongo_db_dep)):
    _get_project(db, project_id)
    return [ProjectKbRead.model_validate(x) for x in kb_list(mdb, project_id)]


@router.post("/{project_id}/kb", response_model=ProjectKbRead)
def create_kb(project_id: int, payload: ProjectKbCreate, db: Session = Depends(get_db), mdb=Depends(mongo_db_dep)):
    _get_project(db, project_id)
    kid = kb_insert(mdb, project_id=project_id, title=payload.title, content=payload.content)
    doc = kb_get(mdb, kid)
    return ProjectKbRead.model_validate(doc)


@router.put("/{project_id}/kb/{kb_id}", response_model=ProjectKbRead)
def update_kb(
    project_id: int,
    kb_id: str,
    payload: ProjectKbUpdate,
    db: Session = Depends(get_db),
    mdb=Depends(mongo_db_dep),
):
    _get_project(db, project_id)
    doc = kb_get(mdb, kb_id)
    if not doc or doc.get("project_id") != project_id:
        raise HTTPException(status_code=404, detail="KB entry not found")
    if not kb_update(mdb, kb_id, title=payload.title, content=payload.content):
        raise HTTPException(status_code=404, detail="KB entry not found")
    doc2 = kb_get(mdb, kb_id)
    return ProjectKbRead.model_validate(doc2)


@router.delete("/{project_id}/kb/{kb_id}")
def delete_kb_entry(project_id: int, kb_id: str, db: Session = Depends(get_db), mdb=Depends(mongo_db_dep)):
    _get_project(db, project_id)
    doc = kb_get(mdb, kb_id)
    if not doc or doc.get("project_id") != project_id:
        raise HTTPException(status_code=404, detail="KB entry not found")
    kb_delete(mdb, kb_id)
    return {"ok": True}


@router.post("/{project_id}/generate-strategy")
def generate_strategy(
    project_id: int,
    payload: GenerateStrategyRequest,
    db: Session = Depends(get_db),
    mdb=Depends(mongo_db_dep),
):
    row = _get_project(db, project_id)
    prov: ProviderName = payload.provider
    if not provider_configured(prov):
        raise HTTPException(status_code=400, detail=f"Provider {prov} is not configured (missing key or base URL).")

    members = (
        db.query(models.ProjectMember)
        .options(joinedload(models.ProjectMember.role_card))
        .filter_by(project_id=project_id)
        .all()
    )
    kb_docs = kb_list(mdb, project_id)
    excerpt_parts: list[str] = []
    budget = payload.kb_excerpt_max_chars
    for d in kb_docs:
        block = f"### {d.get('title', '')}\n{d.get('content', '')}\n"
        if len(block) > budget:
            block = block[:budget] + "\n...[truncated]"
        excerpt_parts.append(block)
        budget -= len(block)
        if budget <= 0:
            break
    kb_blob = "\n".join(excerpt_parts) if excerpt_parts else "(no KB documents)"

    member_lines = []
    for m in members:
        rc = m.role_card
        name = rc.display_name if rc else f"card#{m.role_card_id}"
        job = f" | job={rc.job_title}" if rc and rc.job_title else ""
        load = f" | load={rc.current_load}" if rc and rc.current_load is not None else ""
        member_lines.append(
            f"- {name}{job}{load} | coordination_role={m.coordination_role} | notes={m.notes or ''}"
        )
    member_blob = "\n".join(member_lines) if member_lines else "(no members yet)"

    user_blob = f"""Project: {row.name}
Description: {row.description or ''}

Goals / outline:
{row.goals_text or ''}

Purpose / intent:
{row.purpose_text or ''}

Working rules / details:
{row.working_details_text or ''}

Team:
{member_blob}

Knowledge base excerpts:
{kb_blob}
"""

    system = (
        "You are a delivery lead. Write a concrete execution strategy in Markdown with sections: "
        "1) Phased timeline and milestones, 2) Technical and documentation workstreams, "
        "3) Handoff packages per coordination role (backend, frontend, testing, general). "
        "Be concise and actionable."
    )
    messages = [{"role": "system", "content": system}, {"role": "user", "content": user_blob}]
    try:
        out = chat_completion(prov, messages, model_override=payload.model_override)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    content = out["content"]
    model_used = out["model"]
    sid = strategy_insert(mdb, project_id=project_id, content=content, provider=prov, model=model_used)
    preview = content[:8000] if content else ""
    row.strategy_preview = preview
    db.commit()
    return {"strategy_mongo_id": sid, "content": content, "model": model_used}


@router.get("/{project_id}/strategies")
def list_strategies(project_id: int, db: Session = Depends(get_db), mdb=Depends(mongo_db_dep)):
    _get_project(db, project_id)
    return strategy_list(mdb, project_id)


@router.get("/{project_id}/documents")
def list_markdown_documents(project_id: int, db: Session = Depends(get_db), mdb=Depends(mongo_db_dep)):
    _get_project(db, project_id)
    return md_doc_list(mdb, project_id)


@router.post("/{project_id}/documents")
def create_markdown_document(
    project_id: int,
    payload: MarkdownDocCreate,
    db: Session = Depends(get_db),
    mdb=Depends(mongo_db_dep),
):
    _get_project(db, project_id)
    doc_id = md_doc_create(
        mdb,
        project_id=project_id,
        title=payload.title,
        initial_markdown=payload.initial_markdown,
        source="manual",
    )
    row = md_doc_get(mdb, doc_id)
    latest = md_get_version_row(mdb, doc_id, None)
    return {"id": doc_id, "document": row, "latest": latest}


@router.put("/{project_id}/documents/{doc_id}")
def update_markdown_document(
    project_id: int,
    doc_id: str,
    payload: MarkdownDocUpdate,
    db: Session = Depends(get_db),
    mdb=Depends(mongo_db_dep),
):
    _get_project(db, project_id)
    doc = md_doc_get(mdb, doc_id)
    if not doc or doc.get("project_id") != project_id:
        raise HTTPException(status_code=404, detail="Document not found")
    if not md_doc_update(mdb, doc_id, title=payload.title):
        raise HTTPException(status_code=404, detail="Document not found")
    row = md_doc_get(mdb, doc_id)
    return {"document": row}


@router.get("/{project_id}/documents/{doc_id}")
def get_markdown_document(
    project_id: int,
    doc_id: str,
    db: Session = Depends(get_db),
    mdb=Depends(mongo_db_dep),
    version: int | None = Query(default=None),
):
    _get_project(db, project_id)
    doc = md_doc_get(mdb, doc_id)
    if not doc or doc.get("project_id") != project_id:
        raise HTTPException(status_code=404, detail="Document not found")
    ver_row = md_get_version_row(mdb, doc_id, version)
    if not ver_row:
        raise HTTPException(status_code=404, detail="Version not found")
    versions = md_version_list_meta(mdb, doc_id)
    return {"document": doc, "content": ver_row.get("content"), "version": ver_row.get("version"), "versions": versions}


@router.post("/{project_id}/documents/{doc_id}/versions")
def append_markdown_version(
    project_id: int,
    doc_id: str,
    payload: MarkdownVersionCreate,
    db: Session = Depends(get_db),
    mdb=Depends(mongo_db_dep),
):
    _get_project(db, project_id)
    doc = md_doc_get(mdb, doc_id)
    if not doc or doc.get("project_id") != project_id:
        raise HTTPException(status_code=404, detail="Document not found")
    v = md_version_append(
        mdb,
        doc_id,
        content=payload.content,
        note=payload.note,
        source=payload.source,
        ai_session_id=payload.ai_session_id,
    )
    return {"version": v}


@router.delete("/{project_id}/documents/{doc_id}")
def delete_markdown_document(project_id: int, doc_id: str, db: Session = Depends(get_db), mdb=Depends(mongo_db_dep)):
    _get_project(db, project_id)
    doc = md_doc_get(mdb, doc_id)
    if not doc or doc.get("project_id") != project_id:
        raise HTTPException(status_code=404, detail="Document not found")
    md_doc_delete(mdb, doc_id)
    return {"ok": True}
