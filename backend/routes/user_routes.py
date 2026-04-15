from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from database import db
from auth_utils import require_user
from models import UserUpdate, ReferenceCreate
from db_helpers import enrich_users_with_categories, bulk_fetch_users
import uuid
import asyncio
import time
import logging
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/user", tags=["User"])

UPLOADS_DIR = Path(__file__).parent.parent / "uploads" / "users"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Bounded notification queue (max 200 pending). Overflow spills to MongoDB backlog.
_notification_queue = asyncio.Queue(maxsize=200)
_wa_worker_started = False

# Simple cache for site_settings (refreshed every 60s)
_settings_cache = {"data": None, "ts": 0}


async def _get_cached_settings():
    """Cache site_settings for 60s."""
    now = time.time()
    if _settings_cache["data"] is None or (now - _settings_cache["ts"]) > 60:
        _settings_cache["data"] = await db.site_settings.find_one({"id": "default"}, {"_id": 0})
        _settings_cache["ts"] = now
    return _settings_cache["data"]


async def _send_one_notification(item):
    """Send a single WhatsApp reference notification."""
    from whatsapp_service import send_whatsapp
    settings = await _get_cached_settings()
    template = settings.get("wa_template_reference", "") if settings else ""
    campaign = settings.get("wa_campaign_reference", "") if settings else ""
    if not template or not campaign:
        return
    from_user = await db.users.find_one({"id": item["from_user_id"]}, {"_id": 0, "full_name": 1, "phone": 1})
    to_user = await db.users.find_one({"id": item["to_user_id"]}, {"_id": 0, "full_name": 1, "phone": 1})
    if not from_user or not to_user or not to_user.get("phone"):
        return
    referrer_info = f"{from_user.get('full_name', 'Someone')} - {from_user.get('phone', '')}"
    await send_whatsapp(
        destination=to_user["phone"],
        template_name=template,
        template_params=[
            to_user.get("full_name", "User"),
            referrer_info,
            item.get("contact_name", ""),
            item.get("contact_phone", ""),
        ],
        campaign_name=campaign,
    )


async def _wa_notification_worker():
    """Single worker: drains in-memory queue, then backlog from MongoDB when idle."""
    while True:
        try:
            # 1) Drain in-memory queue (with 0.5s timeout so we can check backlog)
            try:
                item = await asyncio.wait_for(_notification_queue.get(), timeout=0.5)
                await _send_one_notification(item)
                _notification_queue.task_done()
                await asyncio.sleep(0.1)  # ~10/sec rate limit
                continue
            except asyncio.TimeoutError:
                pass

            # 2) Queue empty — check MongoDB backlog for spilled notifications
            backlog_item = await db.notification_backlog.find_one_and_delete({})
            if backlog_item:
                await _send_one_notification(backlog_item)
                await asyncio.sleep(0.1)
            else:
                await asyncio.sleep(2)  # Nothing to do, sleep longer
        except Exception:
            await asyncio.sleep(1)


def _ensure_wa_worker():
    """Start the background worker once."""
    global _wa_worker_started
    if not _wa_worker_started:
        _wa_worker_started = True
        asyncio.create_task(_wa_notification_worker())


@router.post("/upload-photo")
async def upload_user_photo(file: UploadFile = File(...), photo_type: str = "profile_picture", user=Depends(require_user)):
    if photo_type not in ("profile_picture", "company_logo"):
        raise HTTPException(400, "photo_type must be profile_picture or company_logo")
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Only image files allowed")
    content = await file.read()
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"{user['sub']}_{photo_type}.{ext}"
    with open(UPLOADS_DIR / filename, "wb") as f:
        f.write(content)
    file_url = f"/api/uploads/users/{filename}"
    await db.users.update_one({"id": user['sub']}, {"$set": {photo_type: file_url}})
    return {"url": file_url}


@router.get("/profile-status")
async def profile_status(user=Depends(require_user)):
    """Check if user has completed mandatory business fields."""
    profile = await db.users.find_one({"id": user['sub']}, {"_id": 0, "password_hash": 0})
    if not profile:
        raise HTTPException(404, "Profile not found")
    missing = []
    if not profile.get('business_name'):
        missing.append('business_name')
    if not profile.get('category_id'):
        missing.append('category_id')
    if not profile.get('subcategory_id'):
        missing.append('subcategory_id')
    return {"complete": len(missing) == 0, "missing_fields": missing}


@router.get("/profile")
async def get_profile(user=Depends(require_user)):
    profile = await db.users.find_one({"id": user['sub']}, {"_id": 0, "password_hash": 0})
    if not profile:
        raise HTTPException(404, "Profile not found")
    if profile.get('category_id'):
        cat = await db.categories.find_one({"id": profile['category_id']}, {"_id": 0})
        profile['category_name'] = cat['name'] if cat else ''
    if profile.get('subcategory_id'):
        sub = await db.subcategories.find_one({"id": profile['subcategory_id']}, {"_id": 0})
        profile['subcategory_name'] = sub['name'] if sub else ''
    return profile


@router.put("/profile")
async def update_profile(data: UserUpdate, user=Depends(require_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    # Enforce category lock — only block if actually changing the value
    if 'category_id' in update_data or 'subcategory_id' in update_data:
        settings = await db.site_settings.find_one({"id": "default"}, {"_id": 0, "category_locked": 1})
        if settings and settings.get("category_locked"):
            current = await db.users.find_one({"id": user['sub']}, {"_id": 0, "category_id": 1, "subcategory_id": 1})
            cat_changed = 'category_id' in update_data and update_data['category_id'] != current.get('category_id', '')
            sub_changed = 'subcategory_id' in update_data and update_data['subcategory_id'] != current.get('subcategory_id', '')
            if cat_changed or sub_changed:
                raise HTTPException(403, "Categories are locked by admin")
            # Same values — just strip them so we don't waste a write
            update_data.pop('category_id', None)
            update_data.pop('subcategory_id', None)
    if update_data:
        social_fields = ['linkedin', 'instagram', 'twitter', 'youtube', 'whatsapp', 'facebook', 'website']
        social_updates = {}
        for f in social_fields:
            if f in update_data:
                social_updates[f"social_links.{f}"] = update_data.pop(f)
        all_updates = {**update_data, **social_updates}
        if all_updates:
            await db.users.update_one({"id": user['sub']}, {"$set": all_updates})
    return await db.users.find_one({"id": user['sub']}, {"_id": 0, "password_hash": 0})


@router.get("/events")
async def get_available_events(user=Depends(require_user)):
    events = await db.events.find({}, {"_id": 0}).to_list(50)
    user_regs = await db.event_registrations.find({"user_id": user['sub']}, {"_id": 0}).to_list(50)
    reg_event_ids = {r['event_id'] for r in user_regs}
    for e in events:
        e['is_registered'] = e['id'] in reg_event_ids
    return events


@router.post("/events/{event_id}/register")
async def register_for_event(event_id: str, user=Depends(require_user)):
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(404, "Event not found")
    if not event.get('registration_open', True):
        raise HTTPException(400, "Registration is closed")
    existing = await db.event_registrations.find_one({"event_id": event_id, "user_id": user['sub']})
    if existing:
        raise HTTPException(400, "Already registered")
    await db.event_registrations.insert_one({
        "id": str(uuid.uuid4()),
        "event_id": event_id,
        "user_id": user['sub'],
        "payment_status": "pending",
        "registered_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Registered successfully", "payment_type": event.get('payment_type', 'manual'), "payment_link": event.get('payment_link', '')}


@router.get("/events/{event_id}/my-tables")
async def get_my_tables(event_id: str, user=Depends(require_user)):
    assignments = await db.table_assignments.find(
        {"event_id": event_id, "$or": [{"user_ids": user['sub']}, {"captain_id": user['sub']}]},
        {"_id": 0}
    ).sort("round_number", 1).to_list(50)
    return assignments


@router.get("/events/{event_id}/table-people/{round_number}")
async def get_table_people(event_id: str, round_number: int, user=Depends(require_user)):
    assignment = await db.table_assignments.find_one(
        {"event_id": event_id, "round_number": round_number,
         "$or": [{"user_ids": user['sub']}, {"captain_id": user['sub']}]},
        {"_id": 0}
    )
    if not assignment:
        raise HTTPException(404, "No table assignment found")
    all_user_ids = list(assignment.get('user_ids', []))
    if assignment.get('captain_id'):
        all_user_ids.append(assignment['captain_id'])
    other_ids = [uid for uid in all_user_ids if uid != user['sub']]
    user_map = await bulk_fetch_users(other_ids)
    people = [user_map[uid] for uid in other_ids if uid in user_map]
    return {"table_number": assignment['table_number'], "people": people}


@router.post("/references")
async def punch_reference(data: ReferenceCreate, user=Depends(require_user)):
    ref_doc = {
        "id": str(uuid.uuid4()),
        "event_id": data.event_id,
        "from_user_id": user['sub'],
        "to_user_id": data.to_user_id,
        "round_number": data.round_number,
        "table_number": data.table_number,
        "notes": data.notes,
        "contact_name": data.contact_name,
        "contact_phone": data.contact_phone,
        "contact_email": data.contact_email,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.references.insert_one(ref_doc)

    # Queue WhatsApp notification (non-blocking, spills to MongoDB backlog if queue full)
    _ensure_wa_worker()
    notification = {
        "from_user_id": user['sub'],
        "to_user_id": data.to_user_id,
        "contact_name": data.contact_name,
        "contact_phone": data.contact_phone,
    }
    try:
        _notification_queue.put_nowait(notification)
    except asyncio.QueueFull:
        # Spill to persistent backlog — worker will pick it up when queue drains
        await db.notification_backlog.insert_one(notification)

    return {"message": "Reference passed", "id": ref_doc['id']}


@router.get("/references/{event_id}")
async def get_my_references(event_id: str, user=Depends(require_user)):
    given = await db.references.find({"event_id": event_id, "from_user_id": user['sub']}, {"_id": 0}).to_list(500)
    received = await db.references.find({"event_id": event_id, "to_user_id": user['sub']}, {"_id": 0}).to_list(500)
    all_ids = set(r['to_user_id'] for r in given) | set(r['from_user_id'] for r in received)
    user_map = await bulk_fetch_users(all_ids, enrich=False)
    for ref in given:
        ref['to_user'] = user_map.get(ref['to_user_id'])
    for ref in received:
        ref['from_user'] = user_map.get(ref['from_user_id'])
    return {"given": given, "received": received}


@router.get("/categories")
async def get_categories_for_user(user=Depends(require_user)):
    return await db.categories.find({}, {"_id": 0}).to_list(200)


@router.get("/subcategories")
async def get_subcategories_for_user(category_id: str = None, user=Depends(require_user)):
    query = {}
    if category_id:
        query["category_id"] = category_id
    return await db.subcategories.find(query, {"_id": 0}).to_list(500)
