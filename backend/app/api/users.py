from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

import os
import time

from ..schemas import Register, Login, ThemeUpdate, UserPublic
from ..database import get_db
from ..models import User
from ..dependencies import get_current_user
from ..utils import hash_password, verify_password, create_access_token

user_router = APIRouter(prefix="/users", tags=["Users"])

COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
REGISTRATION_ENABLED = os.getenv("REGISTRATION_ENABLED", "true").lower() == "true"
LOGIN_WINDOW_SECONDS = 60
LOGIN_MAX_ATTEMPTS = 5
# PRODUCTION: configure a shorter lifetime in .env when persistent login is not required.
SESSION_MAX_AGE_SECONDS = int(os.getenv("SESSION_MAX_AGE_SECONDS", str(10 * 365 * 24 * 60 * 60)))
login_attempts: dict[str, list[float]] = {}

@user_router.post("/register", response_model=UserPublic)
async def register(userdata:Register, db: AsyncSession = Depends(get_db)):
    if not REGISTRATION_ENABLED:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Registration is disabled")

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
async def login(userdata:Login, request: Request, response:Response, db: AsyncSession = Depends(get_db)):
    client_id = request.client.host if request.client else "unknown"
    now = time.monotonic()
    recent_attempts = [
        attempt for attempt in login_attempts.get(client_id, [])
        if now - attempt < LOGIN_WINDOW_SECONDS
    ]
    if len(recent_attempts) >= LOGIN_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Try again in one minute.",
        )

    query = select(User).where(User.login == userdata.login)
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    if user is None:
        login_attempts[client_id] = [*recent_attempts, now]
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(userdata.password, user.pass_hash):
        login_attempts[client_id] = [*recent_attempts, now]
        raise HTTPException(status_code=401, detail="Invalid credentials")

    login_attempts.pop(client_id, None)

    token = create_access_token(user_id=user.id)

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=SESSION_MAX_AGE_SECONDS,
    )

    return {"message": "Login successful"}


@user_router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key="access_token", secure=COOKIE_SECURE, samesite="lax")

    return {"message": "Logout successful"}


@user_router.get("/me", response_model=UserPublic)
async def current_user(current_user: User = Depends(get_current_user)):
    return current_user

@user_router.patch("/me/theme", response_model=UserPublic)
async def update_theme(
    payload: ThemeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.theme = payload.theme
    await db.commit()
    await db.refresh(current_user)
    return current_user
