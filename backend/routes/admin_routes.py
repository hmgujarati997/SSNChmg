from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from database import db
from auth_utils import require_admin, hash_password
from models import (EventCreate, EventUpdate, CategoryCreate, SubCategoryCreate,
                    VolunteerCreate, TableCaptainAssign, SiteSettingsUpdate, RoundControl,
                    AdminUserCreate, AdminUserEdit)
from db_helpers import enrich_users_with_categories, bulk_fetch_users
from seating import assign_tables
import uuid
import io
import csv
from datetime import datetime, timezone

router = APIRouter(prefix="/api/admin", tags=["Admin"])


# ========== DASHBOARD ==========
@router.get("/dashboard/stats")
async def dashboard_stats(admin=Depends(require_admin)):
    total_users = await db.users.count_documents({})
    total_events = await db.events.count_documents({})
    total_volunteers = await db.volunteers.count_documents({})
    total_categories = await db.categories.count_documents({})
    active_event = await db.events.find_one({"status": {"$in": ["upcoming", "live"]}}, {"_id": 0})
    active_registrations = 0
    total_refs = 0
    if active_event:
        active_registrations = await db.event_registrations.count_documents({"event_id": active_event['id']})
        total_refs = await db.references.count_documents({"event_id": active_event['id']})
    return {
        "total_users": total_users,
        "total_events": total_events,
        "total_volunteers": total_volunteers,
        "total_categories": total_categories,
        "active_event": active_event,
        "active_registrations": active_registrations,
        "total_references": total_refs
    }


# ========== EVENTS ==========
@router.post("/events")
async def create_event(data: EventCreate, admin=Depends(require_admin)):
    event_doc = {
        "id": str(uuid.uuid4()),
        **data.model_dump(),
        "registration_open": True,
        "status": "upcoming",
        "current_round": 0,
        "round_start_time": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.events.insert_one(event_doc)
    return await db.events.find_one({"id": event_doc["id"]}, {"_id": 0})


@router.get("/events")
async def list_events(admin=Depends(require_admin)):
    events = await db.events.find({}, {"_id": 0}).to_list(100)
    if events:
        event_ids = [e['id'] for e in events]
        pipeline = [
            {"$match": {"event_id": {"$in": event_ids}}},
            {"$group": {"_id": "$event_id", "count": {"$sum": 1}}}
        ]
        counts = await db.event_registrations.aggregate(pipeline).to_list(len(event_ids))
        count_map = {c['_id']: c['count'] for c in counts}
        for e in events:
            e['registration_count'] = count_map.get(e['id'], 0)
    return events


@router.get("/events/{event_id}")
async def get_event(event_id: str, admin=Depends(require_admin)):
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(404, "Event not found")
    event["registration_count"] = await db.event_registrations.count_documents({"event_id": event_id})
    event["attendance_count"] = await db.attendance.count_documents({"event_id": event_id})
    return event


@router.put("/events/{event_id}")
async def update_event(event_id: str, data: EventUpdate, admin=Depends(require_admin)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(400, "No data to update")
    await db.events.update_one({"id": event_id}, {"$set": update_data})
    return await db.events.find_one({"id": event_id}, {"_id": 0})


@router.delete("/events/{event_id}")
async def delete_event(event_id: str, admin=Depends(require_admin)):
    await db.events.delete_one({"id": event_id})
    await db.event_registrations.delete_many({"event_id": event_id})
    await db.table_assignments.delete_many({"event_id": event_id})
    await db.table_captains.delete_many({"event_id": event_id})
    await db.references.delete_many({"event_id": event_id})
    await db.attendance.delete_many({"event_id": event_id})
    return {"message": "Event deleted"}


@router.post("/events/{event_id}/upload-csv")
async def upload_csv(event_id: str, file: UploadFile = File(...), admin=Depends(require_admin)):
    event = await db.events.find_one({"id": event_id})
    if not event:
        raise HTTPException(404, "Event not found")
    content = await file.read()
    for encoding in ('utf-8-sig', 'utf-8', 'latin-1', 'cp1252'):
        try:
            text = content.decode(encoding)
            break
        except (UnicodeDecodeError, LookupError):
            continue
    else:
        raise HTTPException(400, "Could not decode CSV file. Please save it as UTF-8.")
    reader = csv.DictReader(io.StringIO(text))
    created = 0
    skipped = 0
    registered = 0
    errors = []
    for row in reader:
        phone = row.get('phone', '').strip()
        if not phone:
            errors.append("Missing phone in a row")
            continue
        cat_id = ""
        subcat_id = ""
        cat_name = row.get('category', '').strip()
        subcat_name = row.get('subcategory', '').strip()
        if cat_name:
            cat = await db.categories.find_one({"name": {"$regex": f"^{cat_name}$", "$options": "i"}})
            if cat:
                cat_id = cat['id']
                if subcat_name:
                    subcat = await db.subcategories.find_one({
                        "category_id": cat_id,
                        "name": {"$regex": f"^{subcat_name}$", "$options": "i"}
                    })
                    if subcat:
                        subcat_id = subcat['id']
        existing = await db.users.find_one({"phone": phone})
        if not existing:
            user_doc = {
                "id": str(uuid.uuid4()),
                "full_name": row.get('full_name', '').strip(),
                "phone": phone,
                "email": row.get('email', '').strip(),
                "password_hash": hash_password(phone),
                "business_name": row.get('business_name', '').strip(),
                "category_id": cat_id,
                "subcategory_id": subcat_id,
                "position": row.get('position', '').strip(),
                "profile_picture": "",
                "company_logo": "",
                "social_links": {},
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(user_doc)
            user_id = user_doc['id']
            created += 1
        else:
            user_id = existing['id']
            skipped += 1
        existing_reg = await db.event_registrations.find_one({"event_id": event_id, "user_id": user_id})
        if not existing_reg:
            await db.event_registrations.insert_one({
                "id": str(uuid.uuid4()),
                "event_id": event_id,
                "user_id": user_id,
                "payment_status": "paid",
                "registered_at": datetime.now(timezone.utc).isoformat()
            })
            registered += 1
    return {"created": created, "skipped": skipped, "registered": registered, "errors": errors}


@router.post("/events/{event_id}/assign-tables")
async def assign_event_tables(event_id: str, admin=Depends(require_admin)):
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(404, "Event not found")
    registrations = await db.event_registrations.find(
        {"event_id": event_id, "is_spot": {"$ne": True}}, {"_id": 0}
    ).to_list(2000)
    user_ids = [r['user_id'] for r in registrations]
    users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0}).to_list(2000)
    if not users:
        raise HTTPException(400, "No registered users")
    captains = await db.table_captains.find({"event_id": event_id}, {"_id": 0}).to_list(100)
    for cap in captains:
        user = await db.users.find_one({"id": cap['user_id']}, {"_id": 0})
        if user:
            cap['category_id'] = user.get('category_id', '')
            cap['subcategory_id'] = user.get('subcategory_id', '')
    categories = await db.categories.find({}, {"_id": 0}).to_list(100)
    captain_user_ids = {c['user_id'] for c in captains}
    regular_users = [u for u in users if u['id'] not in captain_user_ids]
    assignments = assign_tables(regular_users, event, captains, categories)
    await db.table_assignments.delete_many({"event_id": event_id})

    # Validate: every regular user must appear in at least one round
    assigned_user_ids = set()
    for round_num, tables in assignments.items():
        for table_num, user_ids_list in tables.items():
            assigned_user_ids.update(user_ids_list)
    missed_users = [u for u in regular_users if u['id'] not in assigned_user_ids]

    for round_num, tables in assignments.items():
        for table_num, user_ids_list in tables.items():
            captain_id = None
            for cap in captains:
                if cap['table_number'] == table_num:
                    captain_id = cap['user_id']
                    break
            await db.table_assignments.insert_one({
                "id": str(uuid.uuid4()),
                "event_id": event_id,
                "round_number": round_num,
                "table_number": table_num,
                "user_ids": user_ids_list,
                "captain_id": captain_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    result = {"message": "Tables assigned", "rounds": len(assignments), "total_users": len(regular_users)}
    if missed_users:
        result["warning"] = f"{len(missed_users)} user(s) could not be assigned. Consider adding more tables or seats."
        result["missed_users"] = [{"id": u['id'], "full_name": u.get('full_name', 'Unknown')} for u in missed_users]
    return result


@router.get("/events/{event_id}/assignments")
async def get_assignments(event_id: str, admin=Depends(require_admin)):
    assignments = await db.table_assignments.find({"event_id": event_id}, {"_id": 0}).sort("round_number", 1).to_list(1000)
    # Collect all user IDs across all assignments
    all_uids = set()
    for a in assignments:
        all_uids.update(a.get('user_ids', []))
        if a.get('captain_id'):
            all_uids.add(a['captain_id'])
    # Bulk fetch all users with categories in 3 queries max
    user_map = await bulk_fetch_users(all_uids)
    for a in assignments:
        a['users'] = [user_map[uid] for uid in a.get('user_ids', []) if uid in user_map]
        a['captain'] = user_map.get(a.get('captain_id'))
    return assignments


@router.post("/events/{event_id}/round-control")
async def round_control(event_id: str, data: RoundControl, admin=Depends(require_admin)):
    event = await db.events.find_one({"id": event_id})
    if not event:
        raise HTTPException(404, "Event not found")
    if data.action == "start":
        round_num = data.round_number or (event.get('current_round', 0) + 1)
        await db.events.update_one({"id": event_id}, {"$set": {
            "current_round": round_num,
            "round_start_time": datetime.now(timezone.utc).isoformat(),
            "status": "live"
        }})
    elif data.action == "end":
        await db.events.update_one({"id": event_id}, {"$set": {"round_start_time": None}})
    elif data.action == "finish":
        await db.events.update_one({"id": event_id}, {"$set": {
            "status": "completed", "current_round": 0, "round_start_time": None
        }})
    return await db.events.find_one({"id": event_id}, {"_id": 0})


@router.post("/events/{event_id}/toggle-registration")
async def toggle_registration(event_id: str, admin=Depends(require_admin)):
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(404, "Event not found")
    new_status = not event.get('registration_open', True)
    await db.events.update_one({"id": event_id}, {"$set": {"registration_open": new_status}})
    return {"registration_open": new_status}


@router.get("/events/{event_id}/registrations")
async def get_registrations(event_id: str, admin=Depends(require_admin)):
    regs = await db.event_registrations.find({"event_id": event_id}, {"_id": 0}).to_list(2000)
    user_ids = [r['user_id'] for r in regs]
    user_map = await bulk_fetch_users(user_ids)
    for r in regs:
        r['user'] = user_map.get(r['user_id'])
    return regs


# ========== CATEGORIES ==========
@router.post("/categories")
async def create_category(data: CategoryCreate, admin=Depends(require_admin)):
    doc = {"id": str(uuid.uuid4()), **data.model_dump()}
    await db.categories.insert_one(doc)
    return await db.categories.find_one({"id": doc["id"]}, {"_id": 0})


@router.get("/categories")
async def list_categories(admin=Depends(require_admin)):
    cats = await db.categories.find({}, {"_id": 0}).sort("name", 1).to_list(200)
    for cat in cats:
        cat['subcategory_count'] = await db.subcategories.count_documents({"category_id": cat['id']})
    return cats


@router.post("/categories/upload-csv")
async def upload_categories_csv(file: UploadFile = File(...), admin=Depends(require_admin)):
    """
    Upload CSV where each column header is a business category
    and rows below are subcategories for that category.
    Duplicates are skipped. Everything sorted A-Z.
    """
    content = await file.read()
    # Try multiple encodings for Excel-exported CSVs
    for encoding in ('utf-8-sig', 'utf-8', 'latin-1', 'cp1252'):
        try:
            text = content.decode(encoding)
            break
        except (UnicodeDecodeError, LookupError):
            continue
    else:
        raise HTTPException(400, "Could not decode CSV file. Please save it as UTF-8.")
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        raise HTTPException(400, "Empty CSV file")

    headers = [h.strip() for h in rows[0] if h.strip()]
    if not headers:
        raise HTTPException(400, "No category headers found in first row")

    cats_created = 0
    cats_skipped = 0
    subs_created = 0
    subs_skipped = 0

    # Sort headers A-Z
    col_map = {}
    for idx, h in enumerate(rows[0]):
        stripped = h.strip()
        if stripped:
            col_map[idx] = stripped

    sorted_cat_names = sorted(col_map.values(), key=lambda x: x.lower())

    # Build reverse lookup: cat_name -> column index
    name_to_cols = {}
    for idx, name in col_map.items():
        name_to_cols.setdefault(name, []).append(idx)

    for cat_name in sorted_cat_names:
        # Check if category already exists (case-insensitive)
        existing_cat = await db.categories.find_one(
            {"name": {"$regex": f"^{cat_name}$", "$options": "i"}}
        )
        if existing_cat:
            cat_id = existing_cat['id']
            cats_skipped += 1
        else:
            cat_id = str(uuid.uuid4())
            await db.categories.insert_one({
                "id": cat_id,
                "name": cat_name,
                "collaborates_with": []
            })
            cats_created += 1

        # Collect all subcategories from all columns for this category
        sub_names = set()
        for col_idx in name_to_cols.get(cat_name, []):
            for row in rows[1:]:
                if col_idx < len(row):
                    val = row[col_idx].strip()
                    if val:
                        sub_names.add(val)

        # Sort subcategories A-Z and insert non-duplicates
        for sub_name in sorted(sub_names, key=lambda x: x.lower()):
            existing_sub = await db.subcategories.find_one({
                "category_id": cat_id,
                "name": {"$regex": f"^{sub_name}$", "$options": "i"}
            })
            if existing_sub:
                subs_skipped += 1
            else:
                await db.subcategories.insert_one({
                    "id": str(uuid.uuid4()),
                    "name": sub_name,
                    "category_id": cat_id
                })
                subs_created += 1

    return {
        "message": "CSV processed successfully",
        "categories_created": cats_created,
        "categories_skipped": cats_skipped,
        "subcategories_created": subs_created,
        "subcategories_skipped": subs_skipped
    }


@router.put("/categories/{cat_id}")
async def update_category(cat_id: str, data: CategoryCreate, admin=Depends(require_admin)):
    await db.categories.update_one({"id": cat_id}, {"$set": data.model_dump()})
    return await db.categories.find_one({"id": cat_id}, {"_id": 0})


@router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, admin=Depends(require_admin)):
    await db.categories.delete_one({"id": cat_id})
    await db.subcategories.delete_many({"category_id": cat_id})
    return {"message": "Category deleted"}


# ========== SUBCATEGORIES ==========
@router.post("/subcategories")
async def create_subcategory(data: SubCategoryCreate, admin=Depends(require_admin)):
    doc = {"id": str(uuid.uuid4()), **data.model_dump()}
    await db.subcategories.insert_one(doc)
    return await db.subcategories.find_one({"id": doc["id"]}, {"_id": 0})


@router.get("/subcategories")
async def list_subcategories(category_id: str = None, admin=Depends(require_admin)):
    query = {}
    if category_id:
        query["category_id"] = category_id
    return await db.subcategories.find(query, {"_id": 0}).sort("name", 1).to_list(500)


@router.put("/subcategories/{sub_id}")
async def update_subcategory(sub_id: str, data: SubCategoryCreate, admin=Depends(require_admin)):
    await db.subcategories.update_one({"id": sub_id}, {"$set": data.model_dump()})
    return await db.subcategories.find_one({"id": sub_id}, {"_id": 0})


@router.delete("/subcategories/{sub_id}")
async def delete_subcategory(sub_id: str, admin=Depends(require_admin)):
    await db.subcategories.delete_one({"id": sub_id})
    return {"message": "Subcategory deleted"}


# ========== USERS ==========
@router.get("/users")
async def list_users(admin=Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(2000)
    await enrich_users_with_categories(users)
    return users


@router.post("/users")
async def create_user(data: AdminUserCreate, admin=Depends(require_admin)):
    """Admin creates a user manually, optionally registers for an event."""
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
        "profile_picture": "",
        "company_logo": "",
        "social_links": {},
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    result = {k: v for k, v in user_doc.items() if k not in ('password_hash', '_id')}

    # Auto-register for event if event_id provided
    if data.event_id and data.event_id != 'none':
        existing_reg = await db.event_registrations.find_one({"event_id": data.event_id, "user_id": user_doc['id']})
        if not existing_reg:
            await db.event_registrations.insert_one({
                "id": str(uuid.uuid4()),
                "event_id": data.event_id,
                "user_id": user_doc['id'],
                "payment_status": "paid",
                "registered_at": datetime.now(timezone.utc).isoformat()
            })
            result['registered_for_event'] = True
    return result


@router.post("/users/upload-csv")
async def upload_users_csv(file: UploadFile = File(...), event_id: str = "", admin=Depends(require_admin)):
    """
    Upload CSV of users. Columns: full_name, phone, email, business_name, category, subcategory, position.
    Optional query param event_id to auto-register all users for an event.
    """
    content = await file.read()
    for encoding in ('utf-8-sig', 'utf-8', 'latin-1', 'cp1252'):
        try:
            text = content.decode(encoding)
            break
        except (UnicodeDecodeError, LookupError):
            continue
    else:
        raise HTTPException(400, "Could not decode CSV file. Please save it as UTF-8.")
    reader = csv.DictReader(io.StringIO(text))
    created = 0
    skipped = 0
    registered = 0
    errors = []
    for row in reader:
        phone = row.get('phone', '').strip()
        if not phone:
            errors.append("Missing phone in a row")
            continue
        cat_id = ""
        subcat_id = ""
        cat_name = row.get('category', '').strip()
        subcat_name = row.get('subcategory', '').strip()
        if cat_name:
            cat = await db.categories.find_one({"name": {"$regex": f"^{cat_name}$", "$options": "i"}})
            if cat:
                cat_id = cat['id']
                if subcat_name:
                    subcat = await db.subcategories.find_one({
                        "category_id": cat_id,
                        "name": {"$regex": f"^{subcat_name}$", "$options": "i"}
                    })
                    if subcat:
                        subcat_id = subcat['id']
        existing = await db.users.find_one({"phone": phone})
        if not existing:
            user_doc = {
                "id": str(uuid.uuid4()),
                "full_name": row.get('full_name', '').strip(),
                "phone": phone,
                "email": row.get('email', '').strip(),
                "password_hash": hash_password(phone),
                "business_name": row.get('business_name', '').strip(),
                "category_id": cat_id,
                "subcategory_id": subcat_id,
                "position": row.get('position', '').strip(),
                "profile_picture": "",
                "company_logo": "",
                "social_links": {},
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(user_doc)
            user_id = user_doc['id']
            created += 1
        else:
            user_id = existing['id']
            skipped += 1
        # Register for event if event_id provided
        if event_id and event_id != 'none':
            existing_reg = await db.event_registrations.find_one({"event_id": event_id, "user_id": user_id})
            if not existing_reg:
                await db.event_registrations.insert_one({
                    "id": str(uuid.uuid4()),
                    "event_id": event_id,
                    "user_id": user_id,
                    "payment_status": "paid",
                    "registered_at": datetime.now(timezone.utc).isoformat()
                })
                registered += 1
    return {"created": created, "skipped": skipped, "registered": registered, "errors": errors}


@router.get("/users/{user_id}")
async def get_user(user_id: str, admin=Depends(require_admin)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(404, "User not found")
    return user


@router.put("/users/{user_id}")
async def update_user_admin(user_id: str, data: AdminUserEdit, admin=Depends(require_admin)):
    """Admin edits a user's details."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(404, "User not found")
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(400, "No fields to update")
    # Check phone uniqueness if changing phone
    if "phone" in update and update["phone"] != user.get("phone"):
        existing = await db.users.find_one({"phone": update["phone"], "id": {"$ne": user_id}})
        if existing:
            raise HTTPException(400, "Phone number already in use by another user")
    await db.users.update_one({"id": user_id}, {"$set": update})
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return updated


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin=Depends(require_admin)):
    """Delete a user and clean up all related data across events."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(404, "User not found")
    await db.users.delete_one({"id": user_id})
    # Cascade: remove registrations, captains, attendance, references, WA messages
    await db.event_registrations.delete_many({"user_id": user_id})
    await db.table_captains.delete_many({"user_id": user_id})
    await db.attendance.delete_many({"user_id": user_id})
    await db.references.delete_many({"$or": [{"from_user_id": user_id}, {"to_user_id": user_id}]})
    await db.whatsapp_messages.delete_many({"user_id": user_id})
    # Remove user from table_assignments user_ids arrays
    await db.table_assignments.update_many(
        {"user_ids": user_id},
        {"$pull": {"user_ids": user_id}}
    )
    return {"message": "User and all related data deleted"}


@router.delete("/users")
async def delete_all_users(admin=Depends(require_admin)):
    """Delete ALL users and clean up all related data."""
    result = await db.users.delete_many({})
    deleted_count = result.deleted_count
    # Cascade: clean up all user-related collections
    await db.event_registrations.delete_many({})
    await db.table_captains.delete_many({})
    await db.attendance.delete_many({})
    await db.references.delete_many({})
    await db.whatsapp_messages.delete_many({})
    await db.table_assignments.delete_many({})
    return {"message": f"All {deleted_count} users and related data deleted", "deleted": deleted_count}


# ========== VOLUNTEERS ==========
@router.post("/volunteers")
async def create_volunteer(data: VolunteerCreate, admin=Depends(require_admin)):
    existing = await db.volunteers.find_one({"phone": data.phone})
    if existing:
        raise HTTPException(400, "Phone already registered")
    doc = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "phone": data.phone,
        "email": data.email,
        "password_hash": hash_password(data.password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.volunteers.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ('password_hash', '_id')}


@router.get("/volunteers")
async def list_volunteers(admin=Depends(require_admin)):
    return await db.volunteers.find({}, {"_id": 0, "password_hash": 0}).to_list(100)


@router.delete("/volunteers/{vol_id}")
async def delete_volunteer(vol_id: str, admin=Depends(require_admin)):
    await db.volunteers.delete_one({"id": vol_id})
    return {"message": "Volunteer deleted"}


# ========== TABLE CAPTAINS ==========
@router.post("/table-captains")
async def assign_table_captain(data: TableCaptainAssign, admin=Depends(require_admin)):
    # Check if user is already captain for another table in this event
    existing = await db.table_captains.find_one({
        "event_id": data.event_id,
        "user_id": data.user_id,
        "table_number": {"$ne": data.table_number}
    })
    if existing:
        raise HTTPException(400, f"This user is already captain of Table {existing['table_number']}. Remove them first.")
    await db.table_captains.delete_one({"event_id": data.event_id, "table_number": data.table_number})
    doc = {"id": str(uuid.uuid4()), **data.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.table_captains.insert_one(doc)
    user = await db.users.find_one({"id": data.user_id}, {"_id": 0, "password_hash": 0})
    result = {k: v for k, v in doc.items() if k != '_id'}
    result['user'] = user
    return result


@router.get("/table-captains/{event_id}")
async def list_table_captains(event_id: str, admin=Depends(require_admin)):
    captains = await db.table_captains.find({"event_id": event_id}, {"_id": 0}).to_list(100)
    for c in captains:
        user = await db.users.find_one({"id": c['user_id']}, {"_id": 0, "password_hash": 0})
        c['user'] = user
    return captains


@router.delete("/table-captains/{captain_id}")
async def remove_table_captain(captain_id: str, admin=Depends(require_admin)):
    await db.table_captains.delete_one({"id": captain_id})
    return {"message": "Table captain removed"}


# ========== SITE SETTINGS ==========
@router.get("/settings")
async def get_settings(admin=Depends(require_admin)):
    settings = await db.site_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings:
        settings = {"id": "default", "live_screen_password": "ssnc2026", "razorpay_key_id": "", "razorpay_key_secret": ""}
    admin_doc = await db.admins.find_one({}, {"_id": 0, "password_hash": 0})
    settings['admin_email'] = admin_doc['email'] if admin_doc else ''
    if settings.get('razorpay_key_secret'):
        settings['razorpay_key_secret'] = '***' + settings['razorpay_key_secret'][-4:]
    return settings


@router.put("/settings")
async def update_settings(data: SiteSettingsUpdate, admin=Depends(require_admin)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if 'admin_password' in update_data:
        current_admin = await db.admins.find_one({}, {"_id": 0})
        if current_admin:
            await db.admins.update_one({"id": current_admin['id']}, {"$set": {"password_hash": hash_password(update_data['admin_password'])}})
        del update_data['admin_password']
    if 'admin_email' in update_data:
        current_admin = await db.admins.find_one({}, {"_id": 0})
        if current_admin:
            await db.admins.update_one({"id": current_admin['id']}, {"$set": {"email": update_data['admin_email']}})
        del update_data['admin_email']
    if update_data:
        await db.site_settings.update_one({"id": "default"}, {"$set": update_data}, upsert=True)
    return {"message": "Settings updated"}


@router.post("/upload-logo")
async def upload_logo(file: UploadFile = File(...), logo_type: str = "header_logo", admin=Depends(require_admin)):
    """Upload different logos. logo_type: header_logo, login_logo_1, login_logo_2, favicon, pwa_icon"""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Only image files allowed")
    from pathlib import Path
    from PIL import Image
    import io
    uploads_dir = Path(__file__).parent.parent / "uploads"
    uploads_dir.mkdir(exist_ok=True)
    content = await file.read()
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"{logo_type}.{ext}"
    with open(uploads_dir / filename, "wb") as f:
        f.write(content)
    file_url = f"/api/uploads/{filename}"
    # Generate sized icons for favicon and pwa_icon
    try:
        img = Image.open(io.BytesIO(content)).convert("RGBA")
        if logo_type == "favicon":
            for size, name in [(32, "favicon-32.png"), (16, "favicon-16.png")]:
                icon = Image.new("RGBA", (size, size), (255, 255, 255, 0))
                pad = int(size * 0.05)
                inner = size - 2 * pad
                ratio = min(inner / img.width, inner / img.height)
                nw, nh = int(img.width * ratio), int(img.height * ratio)
                resized = img.resize((nw, nh), Image.LANCZOS)
                icon.paste(resized, ((size - nw) // 2, (size - nh) // 2), resized)
                icon.save(str(uploads_dir / name), "PNG")
            fav = Image.new("RGBA", (32, 32), (255, 255, 255, 0))
            ratio = min(32 / img.width, 32 / img.height)
            nw, nh = int(img.width * ratio), int(img.height * ratio)
            resized = img.resize((nw, nh), Image.LANCZOS)
            fav.paste(resized, ((32 - nw) // 2, (32 - nh) // 2), resized)
            fav.save(str(uploads_dir / "favicon.ico"), format="ICO", sizes=[(32, 32)])
        elif logo_type == "pwa_icon":
            for size, name in [(192, "pwa-icon-192.png"), (512, "pwa-icon-512.png"), (180, "apple-touch-icon.png")]:
                icon = Image.new("RGBA", (size, size), (255, 255, 255, 0))
                pad = int(size * 0.05)
                inner = size - 2 * pad
                ratio = min(inner / img.width, inner / img.height)
                nw, nh = int(img.width * ratio), int(img.height * ratio)
                resized = img.resize((nw, nh), Image.LANCZOS)
                icon.paste(resized, ((size - nw) // 2, (size - nh) // 2), resized)
                icon.save(str(uploads_dir / name), "PNG")
    except Exception:
        pass
    await db.site_settings.update_one({"id": "default"}, {"$set": {logo_type: file_url}}, upsert=True)
    return {"message": "Logo uploaded", "url": file_url, "type": logo_type}
