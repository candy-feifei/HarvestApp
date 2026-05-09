from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class PromptMetrics(BaseModel):
    char_count: int
    line_count: int
    estimated_tokens: int
    placeholder_names: list[str]


class PromptTemplateBase(BaseModel):
    name: str = Field(..., max_length=200)
    description: str | None = None
    body: str


class PromptTemplateCreate(PromptTemplateBase):
    pass


class PromptTemplateUpdate(BaseModel):
    name: str | None = Field(None, max_length=200)
    description: str | None = None
    body: str | None = None


class PromptTemplateRead(PromptTemplateBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    updated_at: datetime | None
    metrics: PromptMetrics


class ChatMessageCreate(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    content: str
    created_at: datetime


class SessionFeedbackCreate(BaseModel):
    rating: int | None = Field(None, ge=1, le=5)
    comment: str | None = None


class SessionFeedbackRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    rating: int | None
    comment: str | None
    created_at: datetime


class ConversationSessionCreate(BaseModel):
    template_id: int | None = None
    title: str | None = Field(None, max_length=300)


class ConversationSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    template_id: int | None
    title: str
    created_at: datetime
    messages: list[ChatMessageRead] = []
    feedbacks: list[SessionFeedbackRead] = []


class RenderPreviewRequest(BaseModel):
    body: str
    variables: dict[str, str] = Field(default_factory=dict)


class RoleSkillIn(BaseModel):
    skill_name: str = Field(..., max_length=120)
    level: Literal["expert", "proficient", "familiar", "basic"] = "familiar"


class RoleSkillRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    skill_name: str
    level: str


class RoleCardCreate(BaseModel):
    display_name: str = Field(..., max_length=200)
    notes: str | None = None
    job_title: str | None = Field(None, max_length=200)
    team_name: str | None = Field(None, max_length=200)
    current_load: int = Field(0, ge=0, le=999)
    skills: list[RoleSkillIn] = Field(default_factory=list)


class RoleCardUpdate(BaseModel):
    display_name: str | None = Field(None, max_length=200)
    notes: str | None = None
    job_title: str | None = Field(None, max_length=200)
    team_name: str | None = Field(None, max_length=200)
    current_load: int | None = Field(None, ge=0, le=999)
    skills: list[RoleSkillIn] | None = None


class RoleCardRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str
    notes: str | None
    job_title: str | None = None
    team_name: str | None = None
    current_load: int = 0
    skills: list[RoleSkillRead]


class RoleEngineSettings(BaseModel):
    enabled: bool = False
    allocation_principles: str = (
        "Assign the lead to the highest match; near-equal scores may pair for collaboration; "
        "schedule review or knowledge transfer for weak coverage; high-risk work uses two-person check."
    )
    load_penalty_per_unit: float = Field(
        3.0,
        ge=0.0,
        le=50.0,
        description="Subtracted per current_load point from skill match % (person-task flow).",
    )


class TaskEvaluateRequest(BaseModel):
    goal: str = Field(..., min_length=1)
    persist: bool = True
    force_engine: bool | None = None


class TaskEvaluationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    goal_text: str
    engine_enabled: bool
    principles_snapshot: str | None
    created_at: datetime
    result: dict


CoordinationRole = Literal["backend", "frontend", "testing", "general"]


class ProjectCreate(BaseModel):
    name: str = Field(..., max_length=200)
    description: str | None = None
    goals_text: str | None = None
    purpose_text: str | None = None
    working_details_text: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = Field(None, max_length=200)
    description: str | None = None
    goals_text: str | None = None
    purpose_text: str | None = None
    working_details_text: str | None = None


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    goals_text: str | None
    purpose_text: str | None
    working_details_text: str | None
    strategy_preview: str | None
    created_at: datetime
    updated_at: datetime | None = None


class ProjectMemberCreate(BaseModel):
    role_card_id: int
    coordination_role: CoordinationRole = "general"
    notes: str | None = None


class ProjectMemberRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    role_card_id: int
    coordination_role: str
    notes: str | None
    role_display_name: str | None = None


class ProjectTaskCreate(BaseModel):
    title: str = Field(..., max_length=300)
    description: str | None = None
    required_skills: list[str] = Field(default_factory=list)
    suggested_template_id: int | None = None
    assigned_role_card_id: int | None = None


class ProjectTaskUpdate(BaseModel):
    title: str | None = Field(None, max_length=300)
    description: str | None = None
    required_skills: list[str] | None = None
    suggested_template_id: int | None = None
    assigned_role_card_id: int | None = None


class ProjectTaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    title: str
    description: str | None
    required_skills: list[str]
    suggested_template_id: int | None
    assigned_role_card_id: int | None
    created_at: datetime
    updated_at: datetime | None = None


class ProjectAgentLinkCreate(BaseModel):
    template_id: int


class ProjectAgentLinkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    template_id: int
    template_name: str | None = None
    created_at: datetime


class ProjectTaskMatchRequest(BaseModel):
    force_engine: bool | None = None


class ProjectKbCreate(BaseModel):
    title: str = Field(..., max_length=300)
    content: str


class ProjectKbUpdate(BaseModel):
    title: str | None = Field(None, max_length=300)
    content: str | None = None


class ProjectKbRead(BaseModel):
    id: str
    project_id: int
    title: str
    content: str
    created_at: datetime | None = None
    updated_at: datetime | None = None


class AIChatRequest(BaseModel):
    provider: Literal["deepseek", "qwen", "yuanbao"]
    message: str = Field(..., min_length=1)
    session_id: str | None = None
    project_id: int | None = None
    template_id: int | None = None
    template_variables: dict[str, str] = Field(default_factory=dict)
    model_override: str | None = None
    linked_markdown_document_id: str | None = None


class MarkdownDocCreate(BaseModel):
    title: str = Field(..., max_length=300)
    initial_markdown: str = ""


class MarkdownDocUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)


class MarkdownVersionCreate(BaseModel):
    content: str
    note: str | None = None
    source: str = "chat"
    ai_session_id: str | None = None


class GenerateStrategyRequest(BaseModel):
    provider: Literal["deepseek", "qwen", "yuanbao"] = "deepseek"
    model_override: str | None = None
    kb_excerpt_max_chars: int = Field(12000, ge=1000, le=100000)
