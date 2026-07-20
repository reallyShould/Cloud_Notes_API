from passlib.context import CryptContext

import os
import secrets
import jwt
from datetime import datetime, timedelta, timezone

# PRODUCTION: set a persistent random JWT_SECRET_KEY in .env. The fallback changes on restart.
SECRET_KEY = os.getenv("JWT_SECRET_KEY") or secrets.token_urlsafe(48)
ALGORITHM = "HS256"
# Set to 0 for non-expiring tokens. A finite value is safer for public deployments.
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "0"))


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(user_id: int) -> str:
    to_encode = {
        "sub": str(user_id),
    }
    if JWT_EXPIRE_MINUTES > 0:
        to_encode["exp"] = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> int | None:
    try:
        d_token = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return int(d_token.get("sub"))
    except jwt.InvalidTokenError:
        return None
