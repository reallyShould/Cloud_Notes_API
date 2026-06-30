from fastapi import APIRouter, Depends, HTTPException, Response

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..schemas import Register, Login
from ..database import get_db
from ..models import User
from ..utils import hash_password, verify_password, create_access_token

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

@user_router.post("/login")
async def login(userdata:Login, response:Response, db: AsyncSession = Depends(get_db)):
    query = select(User).where(User.login == userdata.login)
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(userdata.password, user.pass_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(user_id=user.id)

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=1800
    )

    print(token)

    return {"message": "Login successful"}
