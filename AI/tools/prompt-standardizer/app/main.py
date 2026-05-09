import json
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app import models
from app.database import SessionLocal, get_db, init_db
from app.matching import RoleCardView, RoleSkillView, dumps_result, evaluate_roles_for_goal
from app.role_engine_config import ROLE_ENGINE_KEY, load_role_engine_settings, save_role_engine_settings
from app.metrics import compute_metrics, render_template
from app.routers import ai as ai_routes
from app.routers import projects as projects_routes
from app.schemas import (
    ChatMessageCreate,
    ChatMessageRead,
    ConversationSessionCreate,
    ConversationSessionRead,
    PromptTemplateCreate,
    PromptTemplateRead,
    PromptTemplateUpdate,
    RenderPreviewRequest,
    RoleCardCreate,
    RoleCardRead,
    RoleCardUpdate,
    RoleEngineSettings,
    RoleSkillRead,
    SessionFeedbackCreate,
    SessionFeedbackRead,
    TaskEvaluateRequest,
    TaskEvaluationRead,
)

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


def _role_to_read(r: models.RoleCard) -> RoleCardRead:
    return RoleCardRead(
        id=r.id,
        display_name=r.display_name,
        notes=r.notes,
        job_title=r.job_title,
        team_name=r.team_name,
        current_load=r.current_load if r.current_load is not None else 0,
        skills=[RoleSkillRead.model_validate(sk) for sk in r.skills],
    )


def _get_role_card_loaded(db: Session, role_id: int) -> models.RoleCard | None:
    stmt = select(models.RoleCard).options(joinedload(models.RoleCard.skills)).where(models.RoleCard.id == role_id)
    return db.scalars(stmt).unique().first()


app = FastAPI(title="Prompt Standardizer", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects_routes.router)
app.include_router(ai_routes.router)


@app.on_event("startup")
def on_startup():
    init_db()
    db = SessionLocal()
    try:
        if db.get(models.AppSetting, ROLE_ENGINE_KEY) is None:
            db.add(
                models.AppSetting(
                    key=ROLE_ENGINE_KEY,
                    value=json.dumps(RoleEngineSettings().model_dump(), ensure_ascii=False),
                )
            )
            db.commit()
        if db.query(models.PromptTemplate).count() == 0:
            default_body = (
                "You are a professional assistant. Respond using this structure:\n"
                "1) Conclusion\n"
                "2) Evidence\n"
                "3) Risks and limits\n\n"
                "Context: {{context}}\n"
                "User question: {{question}}\n"
            )
            db.add(
                models.PromptTemplate(
                    name="Default structured template",
                    description="Uses placeholders {{context}} and {{question}}; edit as needed.",
                    body=default_body,
                )
            )
            db.commit()
        if db.query(models.RoleCard).count() == 0:
            sample = models.RoleCard(
                display_name="Alex Chen",
                notes="Sample person: strong on front-end stacks; varying depth on back-end languages. Delete or replace.",
                job_title="Senior front-end engineer",
                team_name="Web",
                current_load=2,
            )
            db.add(sample)
            db.flush()
            db.add_all(
                [
                    models.RoleSkill(role_card_id=sample.id, skill_name="React", level="expert"),
                    models.RoleSkill(role_card_id=sample.id, skill_name="Vue", level="proficient"),
                    models.RoleSkill(role_card_id=sample.id, skill_name="Java", level="familiar"),
                    models.RoleSkill(role_card_id=sample.id, skill_name="PHP", level="basic"),
                ]
            )
            db.commit()
    finally:
        db.close()

    try:
        from app.mongo_store import ensure_mongo_indexes, get_mongo_database

        if get_mongo_database() is not None:
            ensure_mongo_indexes()
    except Exception:
        pass


def _template_to_read(t: models.PromptTemplate) -> PromptTemplateRead:
    m = compute_metrics(t.body)
    return PromptTemplateRead(
        id=t.id,
        name=t.name,
        description=t.description,
        body=t.body,
        updated_at=t.updated_at,
        metrics=m,
    )


@app.get("/api/templates", response_model=list[PromptTemplateRead])
def list_templates(db: Session = Depends(get_db)):
    rows = db.query(models.PromptTemplate).order_by(models.PromptTemplate.id.asc()).all()
    return [_template_to_read(r) for r in rows]


@app.post("/api/templates", response_model=PromptTemplateRead)
def create_template(payload: PromptTemplateCreate, db: Session = Depends(get_db)):
    row = models.PromptTemplate(name=payload.name, description=payload.description, body=payload.body)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _template_to_read(row)


@app.get("/api/templates/{template_id}", response_model=PromptTemplateRead)
def get_template(template_id: int, db: Session = Depends(get_db)):
    row = db.get(models.PromptTemplate, template_id)
    if not row:
        raise HTTPException(status_code=404, detail="Template not found")
    return _template_to_read(row)


@app.put("/api/templates/{template_id}", response_model=PromptTemplateRead)
def update_template(template_id: int, payload: PromptTemplateUpdate, db: Session = Depends(get_db)):
    row = db.get(models.PromptTemplate, template_id)
    if not row:
        raise HTTPException(status_code=404, detail="Template not found")
    if payload.name is not None:
        row.name = payload.name
    if payload.description is not None:
        row.description = payload.description
    if payload.body is not None:
        row.body = payload.body
    db.commit()
    db.refresh(row)
    return _template_to_read(row)


@app.delete("/api/templates/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db)):
    row = db.get(models.PromptTemplate, template_id)
    if not row:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(row)
    db.commit()
    return {"ok": True}


@app.post("/api/render-preview")
def render_preview(req: RenderPreviewRequest):
    return {"rendered": render_template(req.body, req.variables), "metrics": compute_metrics(req.body)}


@app.get("/api/sessions", response_model=list[ConversationSessionRead])
def list_sessions(db: Session = Depends(get_db)):
    rows = (
        db.query(models.ConversationSession)
        .order_by(models.ConversationSession.id.desc())
        .limit(200)
        .all()
    )
    return rows


@app.post("/api/sessions", response_model=ConversationSessionRead)
def create_session(payload: ConversationSessionCreate, db: Session = Depends(get_db)):
    title = payload.title or "Untitled session"
    row = models.ConversationSession(template_id=payload.template_id, title=title)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@app.get("/api/sessions/{session_id}", response_model=ConversationSessionRead)
def get_session(session_id: int, db: Session = Depends(get_db)):
    row = db.get(models.ConversationSession, session_id)
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    return row


@app.post("/api/sessions/{session_id}/messages", response_model=ChatMessageRead)
def add_message(session_id: int, payload: ChatMessageCreate, db: Session = Depends(get_db)):
    sess = db.get(models.ConversationSession, session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    msg = models.ChatMessage(session_id=session_id, role=payload.role, content=payload.content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


@app.post("/api/sessions/{session_id}/feedback", response_model=SessionFeedbackRead)
def add_feedback(session_id: int, payload: SessionFeedbackCreate, db: Session = Depends(get_db)):
    sess = db.get(models.ConversationSession, session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    fb = models.SessionFeedback(session_id=session_id, rating=payload.rating, comment=payload.comment)
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return fb


@app.get("/api/role-engine/settings", response_model=RoleEngineSettings)
def get_role_engine_settings(db: Session = Depends(get_db)):
    return load_role_engine_settings(db)


@app.put("/api/role-engine/settings", response_model=RoleEngineSettings)
def put_role_engine_settings(payload: RoleEngineSettings, db: Session = Depends(get_db)):
    save_role_engine_settings(db, payload)
    return payload


@app.get("/api/role-cards", response_model=list[RoleCardRead])
def list_role_cards(db: Session = Depends(get_db)):
    rows = db.query(models.RoleCard).options(joinedload(models.RoleCard.skills)).order_by(models.RoleCard.id.asc()).all()
    return [_role_to_read(r) for r in rows]


@app.post("/api/role-cards", response_model=RoleCardRead)
def create_role_card(payload: RoleCardCreate, db: Session = Depends(get_db)):
    row = models.RoleCard(
        display_name=payload.display_name,
        notes=payload.notes,
        job_title=payload.job_title,
        team_name=payload.team_name,
        current_load=payload.current_load,
    )
    db.add(row)
    db.flush()
    for sk in payload.skills:
        db.add(models.RoleSkill(role_card_id=row.id, skill_name=sk.skill_name, level=sk.level))
    db.commit()
    row = _get_role_card_loaded(db, row.id)
    return _role_to_read(row)


@app.get("/api/role-cards/{role_id}", response_model=RoleCardRead)
def get_role_card(role_id: int, db: Session = Depends(get_db)):
    row = _get_role_card_loaded(db, role_id)
    if not row:
        raise HTTPException(status_code=404, detail="Role card not found")
    return _role_to_read(row)


@app.put("/api/role-cards/{role_id}", response_model=RoleCardRead)
def update_role_card(role_id: int, payload: RoleCardUpdate, db: Session = Depends(get_db)):
    row = _get_role_card_loaded(db, role_id)
    if not row:
        raise HTTPException(status_code=404, detail="Role card not found")
    if payload.display_name is not None:
        row.display_name = payload.display_name
    if payload.notes is not None:
        row.notes = payload.notes
    if payload.job_title is not None:
        row.job_title = payload.job_title
    if payload.team_name is not None:
        row.team_name = payload.team_name
    if payload.current_load is not None:
        row.current_load = payload.current_load
    if payload.skills is not None:
        for sk in list(row.skills):
            db.delete(sk)
        db.flush()
        for sk in payload.skills:
            db.add(models.RoleSkill(role_card_id=row.id, skill_name=sk.skill_name, level=sk.level))
    db.commit()
    row = _get_role_card_loaded(db, role_id)
    return _role_to_read(row)


@app.delete("/api/role-cards/{role_id}")
def delete_role_card(role_id: int, db: Session = Depends(get_db)):
    row = db.get(models.RoleCard, role_id)
    if not row:
        raise HTTPException(status_code=404, detail="Role card not found")
    db.delete(row)
    db.commit()
    return {"ok": True}


@app.get("/api/persons", response_model=list[RoleCardRead], tags=["persons"])
def list_persons(db: Session = Depends(get_db)):
    return list_role_cards(db)


@app.post("/api/persons", response_model=RoleCardRead, tags=["persons"])
def create_person(payload: RoleCardCreate, db: Session = Depends(get_db)):
    return create_role_card(payload, db)


@app.get("/api/persons/{person_id}", response_model=RoleCardRead, tags=["persons"])
def get_person(person_id: int, db: Session = Depends(get_db)):
    return get_role_card(person_id, db)


@app.put("/api/persons/{person_id}", response_model=RoleCardRead, tags=["persons"])
def update_person(person_id: int, payload: RoleCardUpdate, db: Session = Depends(get_db)):
    return update_role_card(person_id, payload, db)


@app.delete("/api/persons/{person_id}", tags=["persons"])
def delete_person(person_id: int, db: Session = Depends(get_db)):
    return delete_role_card(person_id, db)


@app.post("/api/role-engine/evaluate")
def evaluate_task_goal(payload: TaskEvaluateRequest, db: Session = Depends(get_db)):
    settings = load_role_engine_settings(db)
    effective_enabled = settings.enabled if payload.force_engine is None else bool(payload.force_engine)
    roles = db.query(models.RoleCard).options(joinedload(models.RoleCard.skills)).order_by(models.RoleCard.id.asc()).all()
    views = [
        RoleCardView(
            id=r.id,
            display_name=r.display_name,
            notes=r.notes,
            skills=[RoleSkillView(skill_name=s.skill_name, level=s.level) for s in r.skills],
        )
        for r in roles
    ]
    result = evaluate_roles_for_goal(
        payload.goal,
        views,
        settings.allocation_principles,
        effective_enabled,
    )
    stored_id = None
    if payload.persist:
        ev = models.TaskEvaluation(
            goal_text=payload.goal,
            engine_enabled=effective_enabled,
            principles_snapshot=settings.allocation_principles,
            result_json=dumps_result(result),
        )
        db.add(ev)
        db.commit()
        db.refresh(ev)
        stored_id = ev.id
    return {"id": stored_id, "result": result}


@app.get("/api/role-engine/evaluations", response_model=list[TaskEvaluationRead])
def list_task_evaluations(limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    rows = db.query(models.TaskEvaluation).order_by(models.TaskEvaluation.id.desc()).limit(limit).all()
    out: list[TaskEvaluationRead] = []
    for r in rows:
        out.append(
            TaskEvaluationRead(
                id=r.id,
                goal_text=r.goal_text,
                engine_enabled=r.engine_enabled,
                principles_snapshot=r.principles_snapshot,
                created_at=r.created_at,
                result=json.loads(r.result_json),
            )
        )
    return out


@app.get("/")
def serve_index():
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
