import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import create_async_engine

from app.database import Base
from app.models import User, Note

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://admin:admin@db:5432/main_db")

engine = create_async_engine(DATABASE_URL, echo=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Здесь можно описать код, который сработает при выключении сервера

app = FastAPI(lifespan=lifespan)

@app.get("/")
async def root():
    return {"message": "Hello from FastAPI backend!"}

@app.get("/health-check")
async def health_check():
    try:
        async with engine.connect() as conn:
            from sqlalchemy import text
            await conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "details": str(e)}
