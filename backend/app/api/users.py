from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..schemas import Register
from ..database import get_db
from ..models import User
from ..utils import hash_password


user_router = APIRouter(prefix="/users", tags=["Users"])

@user_router.post("/register")
async def register(userdata:Register, db: AsyncSession = Depends(get_db)):
    query = select(User).where(User.login == userdata.login)
    result = await db.execute(query)
    existing_user = result.scalar_one_or_none()

    if existing_user is not None:
        raise HTTPException(status_code=400, detail="User already exists")

    user = User(login=userdata.login, pass_hash=hash_password(userdata.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user