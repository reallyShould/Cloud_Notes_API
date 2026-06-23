import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import create_async_engine

from .database import Base
from .models import User, Note
from .api.users import user_router
from .api.system import system_router

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://admin:admin@db:5432/main_db")
engine = create_async_engine(DATABASE_URL, echo=True)

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
            await asyncio.sleep(2)
    yield

app = FastAPI(lifespan=lifespan)
app.include_router(user_router)
app.include_router(system_router)

@app.get("/")
async def root():
    return {"message": "Hello from FastAPI backend!"}


