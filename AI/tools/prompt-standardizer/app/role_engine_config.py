import json

from sqlalchemy.orm import Session

from app import models
from app.schemas import RoleEngineSettings

ROLE_ENGINE_KEY = "role_engine"


def load_role_engine_settings(db: Session) -> RoleEngineSettings:
    row = db.get(models.AppSetting, ROLE_ENGINE_KEY)
    if not row:
        return RoleEngineSettings()
    try:
        data = json.loads(row.value)
        # tolerate older rows missing load_penalty_per_unit
        return RoleEngineSettings.model_validate(data)
    except Exception:
        return RoleEngineSettings()


def save_role_engine_settings(db: Session, s: RoleEngineSettings) -> None:
    row = db.get(models.AppSetting, ROLE_ENGINE_KEY)
    payload = json.dumps(s.model_dump(), ensure_ascii=False)
    if row:
        row.value = payload
    else:
        db.add(models.AppSetting(key=ROLE_ENGINE_KEY, value=payload))
    db.commit()
