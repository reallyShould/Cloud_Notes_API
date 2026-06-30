from fastapi import Depends, HTTPException, Request, status

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from .models import User
from .database import get_db

from .utils import decode_access_token


async def get_current_user(request:Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("access_token")
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,)

    decoded_token = decode_access_token(token)
    if decoded_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,)

    query = select(User).where(User.id == decoded_token)
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,)

    return user