import os
import shutil
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .database import engine
from .api.users import user_router
from .api.notes import notes_router
from .api.system import system_router
from .api.attachments import attachments_router
from .realtime import realtime_hub
from .utils import decode_access_token

@asynccontextmanager
async def lifespan(app: FastAPI):
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


@app.websocket("/events")
async def realtime_events(websocket: WebSocket):
    token = websocket.cookies.get("access_token")
    user_id = decode_access_token(token) if token else None
    if user_id is None:
        await websocket.close(code=4401)
        return

    await realtime_hub.connect(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        realtime_hub.disconnect(user_id, websocket)

@app.get("/")
async def root():
    return {"message": "Hello from FastAPI backend!"}
