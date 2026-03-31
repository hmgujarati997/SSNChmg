"""Day-of-event endpoints: spot registration, close entry, reallocation."""
from fastapi import APIRouter, HTTPException, Depends
from database import db
from auth_utils import require_admin, hash_password
from db_helpers import bulk_fetch_users
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime, timezone
from collections import defaultdict

router = APIRouter(prefix="/api/admin/events", tags=["DayOf"])


class SpotRegister(BaseModel):
    full_name: str
    phone: str
    business_name: str = ""
    category_id: str = ""
    subcategory_id: str = ""
    position: str = ""
    email: str = ""


@router.get("/{event_id}/day-of-status")
async def day_of_status(event_id: str, admin=Depends(require_admin)):
    """Get attendance, absent, and spot registration stats for the event."""
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(404, "Event not found")

    regs = await db.event_registrations.find({"event_id": event_id}, {"_id": 0}).to_list(5000)
    reg_user_ids = [r['user_id'] for r in regs]

    attendance = await db.attendance.find({"event_id": event_id}, {"_id": 0}).to_list(5000)
    attended_ids = {a['user_id'] for a in attendance}

    spot_regs = await db.event_registrations.find(
        {"event_id": event_id, "is_spot": True}, {"_id": 0}
    ).to_list(5000)
    spot_user_ids = [s['user_id'] for s in spot_regs]

    # Get assignments to know who was assigned a table
    assignments = await db.table_assignments.find({"event_id": event_id}, {"_id": 0}).to_list(1000)
    assigned_ids = set()
    for a in assignments:
        for uid in a.get('user_ids', []):
            assigned_ids.add(uid)

    # Absent = registered + assigned but not attended
    absent_ids = [uid for uid in reg_user_ids if uid in assigned_ids and uid not in attended_ids]

    # Spot users needing seats = spot registered but not yet assigned
    spot_needing_seats = [uid for uid in spot_user_ids if uid not in assigned_ids]

    all_ids = list(set(reg_user_ids + spot_user_ids + absent_ids))
    user_map = await bulk_fetch_users(all_ids, enrich=False)

    def user_info(uid):
        u = user_map.get(uid, {})
        return {"id": uid, "full_name": u.get('full_name', '?'), "phone": u.get('phone', ''),
                "business_name": u.get('business_name', ''), "category_name": u.get('category_name', '')}

    entry_closed = event.get('entry_closed', False)

    return {
        "total_registered": len(reg_user_ids),
        "total_attended": len(attended_ids),
        "total_absent": len(absent_ids),
        "total_spot": len(spot_user_ids),
        "spot_needing_seats": len(spot_needing_seats),
        "entry_closed": entry_closed,
        "absent_users": [user_info(uid) for uid in absent_ids],
        "spot_users": [user_info(uid) for uid in spot_user_ids],
        "spot_unseated": [user_info(uid) for uid in spot_needing_seats],
    }


@router.post("/{event_id}/spot-register")
async def spot_register(event_id: str, data: SpotRegister, admin=Depends(require_admin)):
    """Quick spot registration: create user + register for event."""
    event = await db.events.find_one({"id": event_id})
    if not event:
        raise HTTPException(404, "Event not found")
    if not data.full_name or not data.phone:
        raise HTTPException(400, "Name and phone required")

    # Check existing user by phone
    existing = await db.users.find_one({"phone": data.phone})
    if existing:
        user_id = existing['id']
        # Check if already registered
        reg = await db.event_registrations.find_one({"event_id": event_id, "user_id": user_id})
        if reg:
            raise HTTPException(400, "User already registered for this event")
    else:
        user_id = str(uuid.uuid4())
        user_doc = {
            "id": user_id,
            "full_name": data.full_name,
            "phone": data.phone,
            "email": data.email,
            "password_hash": hash_password(data.phone),
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

    # Register for event with spot flag
    await db.event_registrations.insert_one({
        "id": str(uuid.uuid4()),
        "event_id": event_id,
        "user_id": user_id,
        "is_spot": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    # Auto-mark attendance (they're physically present)
    existing_att = await db.attendance.find_one({"event_id": event_id, "user_id": user_id})
    if not existing_att:
        await db.attendance.insert_one({
            "id": str(uuid.uuid4()),
            "event_id": event_id,
            "user_id": user_id,
            "scanned_at": datetime.now(timezone.utc).isoformat()
        })

    return {"message": f"Spot registered: {data.full_name}", "user_id": user_id}


@router.post("/{event_id}/close-entry")
async def close_entry(event_id: str, admin=Depends(require_admin)):
    """Close entry — after this, absent users are identified for reallocation."""
    event = await db.events.find_one({"id": event_id})
    if not event:
        raise HTTPException(404, "Event not found")
    await db.events.update_one({"id": event_id}, {"$set": {"entry_closed": True}})
    return {"message": "Entry closed. You can now reallocate tables."}


@router.post("/{event_id}/reopen-entry")
async def reopen_entry(event_id: str, admin=Depends(require_admin)):
    """Reopen entry if needed."""
    await db.events.update_one({"id": event_id}, {"$set": {"entry_closed": False}})
    return {"message": "Entry reopened."}


@router.post("/{event_id}/reallocate")
async def reallocate_tables(event_id: str, admin=Depends(require_admin)):
    """
    Reallocate tables:
    1. Remove absent users from their assigned tables (frees seats)
    2. Place spot-registered users into freed + vacant seats
    3. Respect category constraints (no same subcategory at one table)
    4. Do NOT move any present user
    """
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(404, "Event not found")

    total_rounds = event.get('total_rounds', 0)

    # Get attendance
    attendance = await db.attendance.find({"event_id": event_id}, {"_id": 0}).to_list(5000)
    attended_ids = {a['user_id'] for a in attendance}

    # Get current assignments
    assignments = await db.table_assignments.find({"event_id": event_id}, {"_id": 0}).to_list(1000)

    # Get spot registrations needing seats
    spot_regs = await db.event_registrations.find(
        {"event_id": event_id, "is_spot": True}, {"_id": 0}
    ).to_list(5000)
    spot_user_ids = {s['user_id'] for s in spot_regs}

    # Identify absent users (registered, assigned, but not attended)
    assigned_user_ids = set()
    for a in assignments:
        for uid in a.get('user_ids', []):
            assigned_user_ids.add(uid)
    absent_ids = assigned_user_ids - attended_ids

    # Spot users needing seats
    spot_needing = spot_user_ids - assigned_user_ids

    if not absent_ids and not spot_needing:
        return {"message": "No changes needed. No absent users and no unassigned spot registrations.", "changes": 0}

    # Fetch user data for constraint checking
    all_user_ids = list(assigned_user_ids | spot_needing)
    user_map = await bulk_fetch_users(all_user_ids, enrich=False)

    # Get captains for subcategory checking
    captains = await db.table_captains.find({"event_id": event_id}, {"_id": 0}).to_list(100)
    captain_map = {}
    for c in captains:
        captain_map[c['table_number']] = c

    removed_count = 0
    placed_count = 0
    unplaced = set()

    # Group assignments by round
    rounds_map = defaultdict(list)
    for assignment in assignments:
        rounds_map[assignment['round_number']].append(assignment)

    # Process round by round — each spot user needs a seat in EVERY round
    for rn in sorted(rounds_map.keys()):
        round_spot_list = list(spot_needing)  # Reset for each round
        round_assignments = rounds_map[rn]

        for assignment in round_assignments:
            tn = assignment['table_number']
            current_users = list(assignment.get('user_ids', []))

            # Step 1: Remove absent users from this table
            new_users = [uid for uid in current_users if uid not in absent_ids]
            removed_from_this = len(current_users) - len(new_users)
            removed_count += removed_from_this

            # Step 2: Calculate available seats at this table
            chairs = event.get('chairs_per_table', 0)
            has_captain = tn in captain_map
            capacity = chairs - (1 if has_captain else 0)
            available = capacity - len(new_users)

            # Step 3: Get current subcategories at this table (for constraint checking)
            table_subcats = set()
            if has_captain:
                cap = captain_map[tn]
                if cap.get('subcategory_id'):
                    table_subcats.add(cap['subcategory_id'])
            for uid in new_users:
                u = user_map.get(uid, {})
                if u.get('subcategory_id'):
                    table_subcats.add(u['subcategory_id'])

            # Step 4: Fill available seats with spot users (respecting constraints)
            remaining_spot = []
            for spot_uid in round_spot_list:
                if available <= 0:
                    remaining_spot.append(spot_uid)
                    continue
                su = user_map.get(spot_uid, {})
                spot_subcat = su.get('subcategory_id', '')

                # HARD constraint: no same subcategory at the table
                if spot_subcat and spot_subcat in table_subcats:
                    remaining_spot.append(spot_uid)
                    continue

                # Place the spot user
                new_users.append(spot_uid)
                if spot_subcat:
                    table_subcats.add(spot_subcat)
                available -= 1
                placed_count += 1

            round_spot_list = remaining_spot

            # Update DB
            await db.table_assignments.update_one(
                {"event_id": event_id, "round_number": rn, "table_number": tn},
                {"$set": {"user_ids": new_users}}
            )

        # Track unplaced after this round
        unplaced = set(round_spot_list)

    unique_removed = removed_count // total_rounds if total_rounds else removed_count
    unique_placed = placed_count // total_rounds if total_rounds else placed_count

    result = {
        "message": f"Reallocation complete. Removed {unique_removed} absent users, placed {unique_placed} spot registrations.",
        "removed_absent": unique_removed,
        "placed_spot": unique_placed,
        "unplaced_spot": len(unplaced),
        "changes": removed_count + placed_count,
    }

    if unplaced:
        result["message"] += f" {len(unplaced)} spot users could not be placed (no available seats matching constraints)."

    return result
