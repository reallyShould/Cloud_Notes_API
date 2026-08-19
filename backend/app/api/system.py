import logging

from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from ..database import get_db

system_router = APIRouter(prefix="/system", tags=["System"])
logger = logging.getLogger(__name__)

@system_router.get("/health-check")
async def health_check(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("""SELECT 1"""))
        return {"status": "ok", "database": "connected", "message": "Health check successful"}
    except Exception as exception:
        logger.exception("Database health check failed")
        raise HTTPException(
            status_code=503,
            detail="Database is unavailable",
        ) from exception
