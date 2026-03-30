"""WhatsApp messaging endpoints for admin."""
from fastapi import APIRouter, HTTPException, Depends
from database import db
from auth_utils import require_admin
from whatsapp_service import send_whatsapp, normalize_phone
from db_helpers import bulk_fetch_users
import uuid
from datetime import datetime, timezone

router = APIRouter(prefix="/api/admin/whatsapp", tags=["WhatsApp"])


@router.post("/send-welcome/{event_id}")
async def send_welcome_messages(event_id: str, template_name: str = "welcome", template_params_template: str = "{full_name}", admin=Depends(require_admin)):
    """Send welcome message to all registered users who haven't received one yet for this event."""
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(404, "Event not found")

    regs = await db.event_registrations.find({"event_id": event_id}, {"_id": 0}).to_list(2000)
    user_ids = [r['user_id'] for r in regs]
    user_map = await bulk_fetch_users(user_ids, enrich=False)

    # Get already sent welcome messages for this event
    already_sent = set()
    sent_docs = await db.whatsapp_messages.find(
        {"event_id": event_id, "message_type": "welcome", "status": "sent"},
        {"_id": 0, "user_id": 1}
    ).to_list(2000)
    already_sent = {d['user_id'] for d in sent_docs}

    results = {"sent": 0, "skipped": 0, "failed": 0, "errors": []}
    for uid in user_ids:
        user = user_map.get(uid)
        if not user or not user.get('phone'):
            continue
        if uid in already_sent:
            results['skipped'] += 1
            continue

        params = [user.get('full_name', 'User')]
        success, resp = await send_whatsapp(
            destination=user['phone'],
            template_name=template_name,
            template_params=params,
            campaign_name=f"welcome_{event_id[:8]}",
            attributes={"event": event.get('name', '')}
        )
        status = "sent" if success else "failed"
        await db.whatsapp_messages.insert_one({
            "id": str(uuid.uuid4()),
            "event_id": event_id,
            "user_id": uid,
            "message_type": "welcome",
            "status": status,
            "response": resp[:200] if resp else "",
            "phone": normalize_phone(user['phone']),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        if success:
            results['sent'] += 1
        else:
            results['failed'] += 1
            results['errors'].append({"user": user.get('full_name', ''), "error": resp[:100]})
    return results


@router.post("/send-assignments/{event_id}")
async def send_assignment_messages(event_id: str, template_name: str = "table_assignment", admin=Depends(require_admin)):
    """Send table assignment messages with QR codes to all assigned users."""
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(404, "Event not found")

    assignments = await db.table_assignments.find({"event_id": event_id}, {"_id": 0}).to_list(1000)
    if not assignments:
        raise HTTPException(400, "No table assignments found. Assign tables first.")

    # Build user -> rounds mapping
    user_tables = {}  # user_id -> {round_number: table_number}
    for a in assignments:
        rn = a['round_number']
        tn = a['table_number']
        for uid in a.get('user_ids', []):
            if uid not in user_tables:
                user_tables[uid] = {}
            user_tables[uid][rn] = tn
        if a.get('captain_id'):
            cid = a['captain_id']
            if cid not in user_tables:
                user_tables[cid] = {}
            user_tables[cid][rn] = tn

    all_user_ids = list(user_tables.keys())
    user_map = await bulk_fetch_users(all_user_ids, enrich=False)

    # Get the app's base URL for QR code links
    import os
    base_url = os.environ.get("BASE_URL", "")

    results = {"sent": 0, "failed": 0, "errors": []}
    for uid, rounds in user_tables.items():
        user = user_map.get(uid)
        if not user or not user.get('phone'):
            continue

        sorted_rounds = sorted(rounds.items())
        table_params = [user.get('full_name', 'User')]
        for rn, tn in sorted_rounds:
            table_params.append(f"Table {tn}")

        # Pad to ensure we have enough params (at least 4: name + 3 rounds)
        while len(table_params) < 4:
            table_params.append("-")

        # Generate QR code URL for user's profile
        qr_url = ""
        if base_url:
            qr_url = f"{base_url}/api/user/qr/{uid}"

        success, resp = await send_whatsapp(
            destination=user['phone'],
            template_name=template_name,
            template_params=table_params,
            campaign_name=f"assignment_{event_id[:8]}",
            attributes={"event": event.get('name', '')},
            media_url=qr_url if qr_url else None
        )
        status = "sent" if success else "failed"
        await db.whatsapp_messages.update_one(
            {"event_id": event_id, "user_id": uid, "message_type": "assignment"},
            {"$set": {
                "status": status,
                "response": resp[:200] if resp else "",
                "phone": normalize_phone(user['phone']),
                "tables": dict(sorted_rounds),
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$setOnInsert": {
                "id": str(uuid.uuid4()),
                "event_id": event_id,
                "user_id": uid,
                "message_type": "assignment",
                "created_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        if success:
            results['sent'] += 1
        else:
            results['failed'] += 1
            results['errors'].append({"user": user.get('full_name', ''), "error": resp[:100]})
    return results


@router.get("/status/{event_id}")
async def get_message_status(event_id: str, message_type: str = "all", admin=Depends(require_admin)):
    """Get WhatsApp message delivery status for an event."""
    query = {"event_id": event_id}
    if message_type != "all":
        query["message_type"] = message_type
    messages = await db.whatsapp_messages.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)

    # Enrich with user names
    user_ids = list({m['user_id'] for m in messages})
    user_map = await bulk_fetch_users(user_ids, enrich=False)
    for m in messages:
        u = user_map.get(m['user_id'])
        m['user_name'] = u.get('full_name', 'Unknown') if u else 'Unknown'
        m['user_phone'] = u.get('phone', '') if u else ''

    sent = sum(1 for m in messages if m['status'] == 'sent')
    failed = sum(1 for m in messages if m['status'] == 'failed')
    return {"total": len(messages), "sent": sent, "failed": failed, "messages": messages}


@router.post("/retry-failed/{event_id}")
async def retry_failed_messages(event_id: str, message_type: str = "welcome", template_name: str = "welcome", admin=Depends(require_admin)):
    """Retry sending failed messages."""
    failed = await db.whatsapp_messages.find(
        {"event_id": event_id, "message_type": message_type, "status": "failed"},
        {"_id": 0}
    ).to_list(2000)
    if not failed:
        return {"message": "No failed messages to retry", "retried": 0}

    user_ids = [m['user_id'] for m in failed]
    user_map = await bulk_fetch_users(user_ids, enrich=False)

    results = {"retried": 0, "sent": 0, "failed": 0}
    for m in failed:
        user = user_map.get(m['user_id'])
        if not user or not user.get('phone'):
            continue

        params = [user.get('full_name', 'User')]
        if message_type == "assignment" and m.get('tables'):
            for rn in sorted(m['tables'].keys()):
                params.append(f"Table {m['tables'][rn]}")
            while len(params) < 4:
                params.append("-")

        success, resp = await send_whatsapp(
            destination=user['phone'],
            template_name=template_name,
            template_params=params,
            campaign_name=f"retry_{event_id[:8]}"
        )
        results['retried'] += 1
        if success:
            results['sent'] += 1
            await db.whatsapp_messages.update_one(
                {"event_id": event_id, "user_id": m['user_id'], "message_type": message_type},
                {"$set": {"status": "sent", "response": resp[:200], "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
        else:
            results['failed'] += 1
    return results
