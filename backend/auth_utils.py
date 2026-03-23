import jwt
import bcrypt
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Header
import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / '.env')

SECRET_KEY = os.environ.get('JWT_SECRET', 'ssnc-speed-networking-2026-secret')
ALGORITHM = "HS256"
TOKEN_EXPIRY_HOURS = 72


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def create_token(sub: str, role: str, extra: dict = None) -> str:
    payload = {
        "sub": sub,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRY_HOURS)
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(' ')[1]
    return decode_token(token)


async def require_admin(authorization: str = Header(None)):
    user = await get_current_user(authorization)
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def require_user(authorization: str = Header(None)):
    user = await get_current_user(authorization)
    if user.get('role') != 'user':
        raise HTTPException(status_code=403, detail="User access required")
    return user


async def require_volunteer(authorization: str = Header(None)):
    user = await get_current_user(authorization)
    if user.get('role') != 'volunteer':
        raise HTTPException(status_code=403, detail="Volunteer access required")
    return user
