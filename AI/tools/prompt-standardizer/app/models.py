from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PromptTemplate(Base):
    """Agent in the product model (prompt + behavior contract)."""

    __tablename__ = "prompt_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    sessions: Mapped[list["ConversationSession"]] = relationship(back_populates="template")


class ConversationSession(Base):
    __tablename__ = "conversation_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    template_id: Mapped[int | None] = mapped_column(ForeignKey("prompt_templates.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False, default="Untitled session")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    template: Mapped["PromptTemplate | None"] = relationship(back_populates="sessions")
    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at",
    )
    feedbacks: Mapped[list["SessionFeedback"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="SessionFeedback.created_at",
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("conversation_sessions.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["ConversationSession"] = relationship(back_populates="messages")


class SessionFeedback(Base):
    __tablename__ = "session_feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("conversation_sessions.id"), nullable=False)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["ConversationSession"] = relationship(back_populates="feedbacks")


class RoleCard(Base):
    """Person in the product model; table name kept for backward compatibility."""

    __tablename__ = "role_cards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    job_title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    team_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    current_load: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    skills: Mapped[list["RoleSkill"]] = relationship(
        back_populates="role",
        cascade="all, delete-orphan",
        order_by="RoleSkill.id",
    )
    project_memberships: Mapped[list["ProjectMember"]] = relationship(back_populates="role_card")


class RoleSkill(Base):
    __tablename__ = "role_skills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role_card_id: Mapped[int] = mapped_column(ForeignKey("role_cards.id"), nullable=False)
    skill_name: Mapped[str] = mapped_column(String(120), nullable=False)
    level: Mapped[str] = mapped_column(String(32), nullable=False, default="familiar")

    role: Mapped["RoleCard"] = relationship(back_populates="skills")


class TaskEvaluation(Base):
    __tablename__ = "task_evaluations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    goal_text: Mapped[str] = mapped_column(Text, nullable=False)
    engine_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    principles_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    result_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AppSetting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    goals_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    purpose_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    working_details_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    strategy_preview: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    members: Mapped[list["ProjectMember"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="ProjectMember.id",
    )
    tasks: Mapped[list["ProjectTask"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="ProjectTask.id",
    )
    agent_links: Mapped[list["ProjectAgentLink"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="ProjectAgentLink.id",
    )


class ProjectTask(Base):
    __tablename__ = "project_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    required_skills_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    suggested_template_id: Mapped[int | None] = mapped_column(ForeignKey("prompt_templates.id"), nullable=True)
    assigned_role_card_id: Mapped[int | None] = mapped_column(ForeignKey("role_cards.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    project: Mapped["Project"] = relationship(back_populates="tasks")
    suggested_template: Mapped["PromptTemplate | None"] = relationship(foreign_keys=[suggested_template_id])
    assignee: Mapped["RoleCard | None"] = relationship(foreign_keys=[assigned_role_card_id])


class ProjectAgentLink(Base):
    __tablename__ = "project_agent_links"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    template_id: Mapped[int] = mapped_column(ForeignKey("prompt_templates.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project: Mapped["Project"] = relationship(back_populates="agent_links")
    template: Mapped["PromptTemplate"] = relationship()

    __table_args__ = (UniqueConstraint("project_id", "template_id", name="uq_project_agent_template"),)


class ProjectMember(Base):
    __tablename__ = "project_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    role_card_id: Mapped[int] = mapped_column(ForeignKey("role_cards.id"), nullable=False)
    coordination_role: Mapped[str] = mapped_column(String(32), nullable=False, default="general")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    project: Mapped["Project"] = relationship(back_populates="members")
    role_card: Mapped["RoleCard"] = relationship(back_populates="project_memberships")
