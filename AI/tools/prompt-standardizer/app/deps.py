from fastapi import HTTPException
from pymongo.database import Database

from app.mongo_store import get_mongo_database


def mongo_db_dep() -> Database:
    db = get_mongo_database()
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="MongoDB is not configured. Set PROMPT_STD_MONGO_URI (example: mongodb://mongo:27017).",
        )
    try:
        db.command("ping")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"MongoDB unreachable: {exc}") from exc
    return db
