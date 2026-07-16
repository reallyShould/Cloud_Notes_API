import os
import asyncio
import shutil
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .models import User, Note
from .api.users import user_router
from .api.notes import notes_router
from .api.system import system_router
from .api.attachments import attachments_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    retries = 5
    while retries > 0:
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            print("Successfully connected to the database and created tables!")
            break
        except Exception as e:
            retries -= 1
            print(f"Database is not ready yet. Retrying in 2 seconds... ({retries} retries left)")
            if retries == 0:
                raise RuntimeError("Could not connect to the database") from e
            await asyncio.sleep(2)

    upload_dir = Path(os.getenv("UPLOAD_DIR", "uploads"))
    legacy_upload_dir = Path("/legacy-uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)
    if legacy_upload_dir.is_dir():
        for legacy_file in legacy_upload_dir.iterdir():
            destination = upload_dir / legacy_file.name
            if legacy_file.is_file() and legacy_file.name != "README.md" and not destination.exists():
                shutil.copy2(legacy_file, destination)

    try:
        yield
    finally:
        await engine.dispose()

app = FastAPI(
    lifespan=lifespan,
    root_path=os.getenv("ROOT_PATH", ""),
    swagger_ui_parameters={"withCredentials": True},
)

cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "").split(",")
    if origin.strip()
]

if cors_origins:
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
