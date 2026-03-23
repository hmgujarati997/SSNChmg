from fastapi import APIRouter, HTTPException, Depends
from database import db
from auth_utils import require_user
from models import UserUpdate, ReferenceCreate
import uuid
from datetime import datetime, timezone

router = APIRouter(prefix="/api/user", tags=["User"])


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
    people = []
    for uid in all_user_ids:
        if uid == user['sub']:
            continue
        u = await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})
        if u:
            if u.get('category_id'):
                cat = await db.categories.find_one({"id": u['category_id']}, {"_id": 0})
                u['category_name'] = cat['name'] if cat else ''
            if u.get('subcategory_id'):
                sub = await db.subcategories.find_one({"id": u['subcategory_id']}, {"_id": 0})
                u['subcategory_name'] = sub['name'] if sub else ''
            people.append(u)
    return {"table_number": assignment['table_number'], "people": people}


@router.post("/references")
async def punch_reference(data: ReferenceCreate, user=Depends(require_user)):
    existing = await db.references.find_one({
        "event_id": data.event_id,
        "from_user_id": user['sub'],
        "to_user_id": data.to_user_id,
        "round_number": data.round_number
    })
    if existing:
        raise HTTPException(400, "Reference already punched for this person in this round")
    ref_doc = {
        "id": str(uuid.uuid4()),
        "event_id": data.event_id,
        "from_user_id": user['sub'],
        "to_user_id": data.to_user_id,
        "round_number": data.round_number,
        "table_number": data.table_number,
        "notes": data.notes,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.references.insert_one(ref_doc)
    return {"message": "Reference punched", "id": ref_doc['id']}


@router.get("/references/{event_id}")
async def get_my_references(event_id: str, user=Depends(require_user)):
    given = await db.references.find({"event_id": event_id, "from_user_id": user['sub']}, {"_id": 0}).to_list(500)
    received = await db.references.find({"event_id": event_id, "to_user_id": user['sub']}, {"_id": 0}).to_list(500)
    for ref in given:
        u = await db.users.find_one({"id": ref['to_user_id']}, {"_id": 0, "password_hash": 0})
        ref['to_user'] = u
    for ref in received:
        u = await db.users.find_one({"id": ref['from_user_id']}, {"_id": 0, "password_hash": 0})
        ref['from_user'] = u
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
