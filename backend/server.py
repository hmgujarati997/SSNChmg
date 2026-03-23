from fastapi import FastAPI
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from database import db, client
from auth_utils import hash_password

app = FastAPI(title="SSNC Speed Networking")

# Import and include routers
from routes.auth_routes import router as auth_router
from routes.admin_routes import router as admin_router
from routes.user_routes import router as user_router
from routes.volunteer_routes import router as volunteer_router
from routes.live_routes import router as live_router
from routes.public_routes import router as public_router

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(user_router)
app.include_router(volunteer_router)
app.include_router(live_router)
app.include_router(public_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup():
    await db.users.create_index("phone", unique=True)
    await db.users.create_index("id", unique=True)
    await db.admins.create_index("email", unique=True)
    await db.admins.create_index("id", unique=True)
    await db.volunteers.create_index("phone", unique=True)
    await db.categories.create_index("id", unique=True)
    await db.subcategories.create_index("id", unique=True)
    await db.events.create_index("id", unique=True)
    await db.event_registrations.create_index([("event_id", 1), ("user_id", 1)], unique=True)
    await db.table_assignments.create_index([("event_id", 1), ("round_number", 1), ("table_number", 1)])
    await db.references.create_index("event_id")
    await db.attendance.create_index([("event_id", 1), ("user_id", 1)], unique=True)

    existing_admin = await db.admins.find_one({})
    if not existing_admin:
        await db.admins.insert_one({
            "id": "admin-001",
            "email": "admin@ssnc.com",
            "password_hash": hash_password("admin123"),
            "created_at": "2026-01-01T00:00:00Z"
        })
        logger.info("Default admin created: admin@ssnc.com / admin123")

    existing_settings = await db.site_settings.find_one({"id": "default"})
    if not existing_settings:
        await db.site_settings.insert_one({
            "id": "default",
            "live_screen_password": "ssnc2026",
            "razorpay_key_id": "",
            "razorpay_key_secret": ""
        })

    logger.info("SSNC Speed Networking API started successfully")


@app.on_event("shutdown")
async def shutdown():
    client.close()


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "SSNC Speed Networking"}
