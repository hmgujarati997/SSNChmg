from fastapi import APIRouter, HTTPException, Depends
from database import db
from auth_utils import require_volunteer
from pydantic import BaseModel
import uuid
from datetime import datetime, timezone


class ScanRequest(BaseModel):
    user_id: str
    event_id: str


router = APIRouter(prefix="/api/volunteer", tags=["Volunteer"])


@router.post("/scan")
async def scan_qr(data: ScanRequest, vol=Depends(require_volunteer)):
    user = await db.users.find_one({"id": data.user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(404, "User not found")
    event = await db.events.find_one({"id": data.event_id}, {"_id": 0})
    if not event:
        raise HTTPException(404, "Event not found")
    reg = await db.event_registrations.find_one({"event_id": data.event_id, "user_id": data.user_id})
    if not reg:
        raise HTTPException(400, "User not registered for this event")
    existing_attendance = await db.attendance.find_one({"event_id": data.event_id, "user_id": data.user_id})
    already_checked = bool(existing_attendance)
    if not existing_attendance:
        await db.attendance.insert_one({
            "id": str(uuid.uuid4()),
            "event_id": data.event_id,
            "user_id": data.user_id,
            "checked_in_by": vol['sub'],
            "checked_in_at": datetime.now(timezone.utc).isoformat()
        })
    assignments = await db.table_assignments.find(
        {"event_id": data.event_id, "$or": [{"user_ids": data.user_id}, {"captain_id": data.user_id}]},
        {"_id": 0}
    ).sort("round_number", 1).to_list(50)
    table_info = [{"round": a['round_number'], "table": a['table_number']} for a in assignments]
    if user.get('category_id'):
        cat = await db.categories.find_one({"id": user['category_id']}, {"_id": 0})
        user['category_name'] = cat['name'] if cat else ''
    return {
        "user": user,
        "already_checked_in": already_checked,
        "table_assignments": table_info,
        "event": {"name": event['name'], "id": event['id']}
    }


@router.get("/events")
async def get_volunteer_events(vol=Depends(require_volunteer)):
    return await db.events.find({"status": {"$in": ["upcoming", "live"]}}, {"_id": 0}).to_list(50)
