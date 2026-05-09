from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(
    settings.effective_database_url,
    connect_args={"check_same_thread": False} if settings.effective_database_url.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _sqlite_add_columns_if_missing() -> None:
    """Lightweight migration for dev SQLite DBs (create_all does not ALTER)."""
    url = str(engine.url)
    if not url.startswith("sqlite"):
        return
    with engine.begin() as conn:
        insp = inspect(engine)
        tables = insp.get_table_names()
        if "role_cards" in tables:
            cols = {c["name"] for c in insp.get_columns("role_cards")}
            alters: list[tuple[str, str]] = []
            if "job_title" not in cols:
                alters.append(("job_title", "VARCHAR(200)"))
            if "team_name" not in cols:
                alters.append(("team_name", "VARCHAR(200)"))
            if "current_load" not in cols:
                alters.append(("current_load", "INTEGER NOT NULL DEFAULT 0"))
            for col, ddl in alters:
                conn.execute(text(f"ALTER TABLE role_cards ADD COLUMN {col} {ddl}"))


def init_db():
    from app import models  # noqa: F401

    settings.data_dir.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    _sqlite_add_columns_if_missing()
