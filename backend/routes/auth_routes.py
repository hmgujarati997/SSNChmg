from fastapi import APIRouter, HTTPException
from database import db
from auth_utils import hash_password, verify_password, create_token
from models import AdminLogin, UserLogin, VolunteerLogin, UserCreate
import uuid
from datetime import datetime, timezone

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/admin/login")
async def admin_login(data: AdminLogin):
    admin = await db.admins.find_one({"email": data.email}, {"_id": 0})
    if not admin or not verify_password(data.password, admin['password_hash']):
        raise HTTPException(400, "Invalid credentials")
    token = create_token(admin['id'], "admin", {"email": admin['email']})
    return {"token": token, "role": "admin", "user": {"id": admin['id'], "email": admin['email']}}


@router.post("/user/login")
async def user_login(data: UserLogin):
    user = await db.users.find_one({"phone": data.phone}, {"_id": 0})
    if not user or not verify_password(data.password, user['password_hash']):
        raise HTTPException(400, "Invalid credentials")
    token = create_token(user['id'], "user", {"phone": user['phone'], "name": user['full_name']})
    return {"token": token, "role": "user", "user": {k: v for k, v in user.items() if k != 'password_hash'}}


@router.post("/user/register")
async def user_register(data: UserCreate):
    if not data.full_name or not data.phone:
        raise HTTPException(400, "Full name and phone number are required")
    if not data.business_name:
        raise HTTPException(400, "Business name is required")
    if not data.category_id:
        raise HTTPException(400, "Business category is required")
    if not data.subcategory_id:
        raise HTTPException(400, "Business sub-category is required")
    existing = await db.users.find_one({"phone": data.phone})
    if existing:
        raise HTTPException(400, "Phone number already registered")

    password = data.password if data.password else data.phone
    user_doc = {
        "id": str(uuid.uuid4()),
        "full_name": data.full_name,
        "phone": data.phone,
        "email": data.email,
        "password_hash": hash_password(password),
        "business_name": data.business_name,
        "category_id": data.category_id,
        "subcategory_id": data.subcategory_id,
        "position": data.position,
        "profile_picture": data.profile_picture,
        "company_logo": data.company_logo,
        "social_links": {
            "linkedin": data.linkedin,
            "instagram": data.instagram,
            "twitter": data.twitter,
            "youtube": data.youtube,
            "whatsapp": data.whatsapp,
            "facebook": data.facebook,
            "website": data.website,
        },
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    token = create_token(user_doc['id'], "user", {"phone": user_doc['phone'], "name": user_doc['full_name']})
    safe_user = {k: v for k, v in user_doc.items() if k not in ('password_hash', '_id')}
    return {"token": token, "role": "user", "user": safe_user}


@router.post("/volunteer/login")
async def volunteer_login(data: VolunteerLogin):
    vol = await db.volunteers.find_one({"phone": data.phone}, {"_id": 0})
    if not vol or not verify_password(data.password, vol['password_hash']):
        raise HTTPException(400, "Invalid credentials")
    token = create_token(vol['id'], "volunteer", {"name": vol['name']})
    return {"token": token, "role": "volunteer", "user": {k: v for k, v in vol.items() if k != 'password_hash'}}
