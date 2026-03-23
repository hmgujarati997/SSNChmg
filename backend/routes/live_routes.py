from fastapi import APIRouter, HTTPException
from database import db
from models import LiveAuthRequest

router = APIRouter(prefix="/api/live", tags=["Live"])


@router.post("/auth")
async def live_auth(data: LiveAuthRequest):
    settings = await db.site_settings.find_one({"id": "default"}, {"_id": 0})
    password = settings.get('live_screen_password', 'ssnc2026') if settings else 'ssnc2026'
    if data.password != password:
        raise HTTPException(401, "Invalid password")
    return {"authenticated": True}


@router.get("/events")
async def get_live_events():
    return await db.events.find({"status": {"$in": ["upcoming", "live"]}}, {"_id": 0}).to_list(50)


@router.get("/stats/{event_id}")
async def get_live_stats(event_id: str):
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(404, "Event not found")
    total_refs = await db.references.count_documents({"event_id": event_id})
    attendance_count = await db.attendance.count_documents({"event_id": event_id})
    reg_count = await db.event_registrations.count_documents({"event_id": event_id})
    return {
        "event": event,
        "total_references": total_refs,
        "attendance_count": attendance_count,
        "registration_count": reg_count
    }


@router.get("/leaderboard/{event_id}")
async def get_leaderboard(event_id: str):
    pipeline_givers = [
        {"$match": {"event_id": event_id}},
        {"$group": {"_id": "$from_user_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    top_givers_raw = await db.references.aggregate(pipeline_givers).to_list(10)
    top_givers = []
    for g in top_givers_raw:
        user = await db.users.find_one({"id": g['_id']}, {"_id": 0, "password_hash": 0})
        if user:
            top_givers.append({"user": {"full_name": user.get('full_name', ''), "business_name": user.get('business_name', '')}, "count": g['count']})

    pipeline_receivers = [
        {"$match": {"event_id": event_id}},
        {"$group": {"_id": "$to_user_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    top_receivers_raw = await db.references.aggregate(pipeline_receivers).to_list(10)
    top_receivers = []
    for r in top_receivers_raw:
        user = await db.users.find_one({"id": r['_id']}, {"_id": 0, "password_hash": 0})
        if user:
            top_receivers.append({"user": {"full_name": user.get('full_name', ''), "business_name": user.get('business_name', '')}, "count": r['count']})

    pipeline_tables = [
        {"$match": {"event_id": event_id}},
        {"$group": {"_id": "$table_number", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20}
    ]
    table_stats = await db.references.aggregate(pipeline_tables).to_list(20)

    pipeline_rounds = [
        {"$match": {"event_id": event_id}},
        {"$group": {"_id": "$round_number", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    round_stats = await db.references.aggregate(pipeline_rounds).to_list(20)

    return {
        "top_givers": top_givers,
        "top_receivers": top_receivers,
        "table_stats": [{"table_number": t['_id'], "count": t['count']} for t in table_stats],
        "round_stats": [{"round": r['_id'], "count": r['count']} for r in round_stats]
    }
