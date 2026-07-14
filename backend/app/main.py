import asyncio
from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from .database import Base, engine
from .models import User, Note, Attachment
from .api.users import user_router
from .api.notes import notes_router
from .api.system import system_router
from .api.attachments import attachments_router


def migrate_existing_schema(connection):
    inspector = inspect(connection)
    note_columns = {column["name"] for column in inspector.get_columns("notes")} if inspector.has_table("notes") else set()

    alterations = {
        "summary": "ALTER TABLE notes ADD COLUMN summary VARCHAR(280)",
        "tags": "ALTER TABLE notes ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'",
        "is_pinned": "ALTER TABLE notes ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT 0",
        "is_favorite": "ALTER TABLE notes ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT 0",
        "is_archived": "ALTER TABLE notes ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT 0",
        "created_time": "ALTER TABLE notes ADD COLUMN created_time DATETIME",
    }

    for column_name, statement in alterations.items():
        if column_name not in note_columns:
            connection.execute(text(statement))

    if inspector.has_table("notes") and "created_time" not in note_columns:
        connection.execute(text("UPDATE notes SET created_time = edit_time WHERE created_time IS NULL"))

@asynccontextmanager
async def lifespan(app: FastAPI):
    retries = 5
    while retries > 0:
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
                await conn.run_sync(migrate_existing_schema)
            print("Successfully connected to the database and created tables!")
            break
        except Exception as e:
            retries -= 1
            print(f"Database is not ready yet. Retrying in 2 seconds... ({retries} retries left)")
            await asyncio.sleep(2)
    yield

app = FastAPI(lifespan=lifespan, swagger_ui_parameters={"withCredentials": True})

cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user_router)
app.include_router(notes_router)
app.include_router(system_router)
app.include_router(attachments_router)

@app.get("/")
async def root():
    return {"message": "Hello from FastAPI backend!"}
