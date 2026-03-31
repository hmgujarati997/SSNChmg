"""WhatsApp messaging endpoints for admin."""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Request
from database import db
from auth_utils import require_admin
from whatsapp_service import send_whatsapp, normalize_phone
from db_helpers import bulk_fetch_users
import uuid
import asyncio
from datetime import datetime, timezone

router = APIRouter(prefix="/api/admin/whatsapp", tags=["WhatsApp"])

# In-memory job tracker
_jobs = {}


async def _run_welcome_job(job_id: str, event_id: str, event_name: str, template_name: str, user_ids: list, user_map: dict, already_done: set):
    """Background: send welcome messages."""
    _jobs[job_id] = {"status": "running", "total": len(user_ids), "sent": 0, "skipped": 0, "failed": 0, "processed": 0}
    for uid in user_ids:
        user = user_map.get(uid)
        if not user or not user.get('phone'):
            _jobs[job_id]['skipped'] += 1
            _jobs[job_id]['processed'] += 1
            continue
        if uid in already_done:
            _jobs[job_id]['skipped'] += 1
            _jobs[job_id]['processed'] += 1
            continue

        params = [user.get('full_name', 'User')]
        success, resp = await send_whatsapp(
            destination=user['phone'],
            template_name=template_name,
            template_params=params,
            campaign_name=f"welcome_{event_id[:8]}",
            attributes={"event": event_name}
        )
        status = "sent" if success else "failed"
        await db.whatsapp_messages.update_one(
            {"event_id": event_id, "user_id": uid, "message_type": "welcome"},
            {"$set": {"status": status, "response": resp[:200] if resp else "", "phone": normalize_phone(user['phone']), "updated_at": datetime.now(timezone.utc).isoformat()},
             "$setOnInsert": {"id": str(uuid.uuid4()), "event_id": event_id, "user_id": uid, "message_type": "welcome", "created_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        if success:
            _jobs[job_id]['sent'] += 1
        else:
            _jobs[job_id]['failed'] += 1
        _jobs[job_id]['processed'] += 1
    _jobs[job_id]['status'] = 'completed'


async def _run_assignment_job(job_id: str, event_id: str, event_name: str, template_name: str, user_tables: dict, user_map: dict, base_url: str):
    """Background: send assignment messages."""
    total = len(user_tables)
    _jobs[job_id] = {"status": "running", "total": total, "sent": 0, "failed": 0, "processed": 0}
    for uid, rounds in user_tables.items():
        user = user_map.get(uid)
        if not user or not user.get('phone'):
            _jobs[job_id]['processed'] += 1
            continue

        sorted_rounds = sorted(rounds.items())
        table_params = [user.get('full_name', 'User')]
        for rn, tn in sorted_rounds:
            table_params.append(f"Table {tn}")
        while len(table_params) < 4:
            table_params.append("-")

        qr_url = f"{base_url}/api/user/qr/{uid}" if base_url else None
        success, resp = await send_whatsapp(
            destination=user['phone'],
            template_name=template_name,
            template_params=table_params,
            campaign_name=f"assignment_{event_id[:8]}",
            attributes={"event": event_name},
            media_url=qr_url
        )
        status = "sent" if success else "failed"
        await db.whatsapp_messages.update_one(
            {"event_id": event_id, "user_id": uid, "message_type": "assignment"},
            {"$set": {"status": status, "response": resp[:200] if resp else "", "phone": normalize_phone(user['phone']), "tables": {str(k): v for k, v in sorted_rounds}, "updated_at": datetime.now(timezone.utc).isoformat()},
             "$setOnInsert": {"id": str(uuid.uuid4()), "event_id": event_id, "user_id": uid, "message_type": "assignment", "created_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        if success:
            _jobs[job_id]['sent'] += 1
        else:
            _jobs[job_id]['failed'] += 1
        _jobs[job_id]['processed'] += 1
    _jobs[job_id]['status'] = 'completed'


@router.post("/send-welcome/{event_id}")
async def send_welcome_messages(event_id: str, template_name: str = "welcome", admin=Depends(require_admin)):
    """Kick off background job to send welcome messages."""
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(404, "Event not found")

    regs = await db.event_registrations.find({"event_id": event_id}, {"_id": 0}).to_list(5000)
    user_ids = [r['user_id'] for r in regs]
    user_map = await bulk_fetch_users(user_ids, enrich=False)

    # Skip users who already got a successful welcome
    sent_docs = await db.whatsapp_messages.find(
        {"event_id": event_id, "message_type": "welcome", "status": "sent"},
        {"_id": 0, "user_id": 1}
    ).to_list(5000)
    already_done = {d['user_id'] for d in sent_docs}

    job_id = str(uuid.uuid4())[:8]
    asyncio.create_task(_run_welcome_job(job_id, event_id, event.get('name', ''), template_name, user_ids, user_map, already_done))
    return {"message": "Welcome messages started", "job_id": job_id, "total": len(user_ids), "already_sent": len(already_done)}


@router.post("/send-assignments/{event_id}")
async def send_assignment_messages(event_id: str, request: Request, template_name: str = "table_assignment", admin=Depends(require_admin)):
    """Kick off background job to send assignment messages."""
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(404, "Event not found")

    assignments = await db.table_assignments.find({"event_id": event_id}, {"_id": 0}).to_list(1000)
    if not assignments:
        raise HTTPException(400, "No table assignments found. Assign tables first.")

    user_tables = {}
    for a in assignments:
        rn = a['round_number']
        tn = a['table_number']
        for uid in a.get('user_ids', []):
            user_tables.setdefault(uid, {})[rn] = tn
        if a.get('captain_id'):
            user_tables.setdefault(a['captain_id'], {})[rn] = tn

    user_map = await bulk_fetch_users(list(user_tables.keys()), enrich=False)
    # Derive external base URL from request headers (set by ingress/proxy)
    forwarded_host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    scheme = request.headers.get("x-forwarded-proto", "https")
    base_url = f"{scheme}://{forwarded_host}" if forwarded_host else str(request.base_url).rstrip('/')

    job_id = str(uuid.uuid4())[:8]
    asyncio.create_task(_run_assignment_job(job_id, event_id, event.get('name', ''), template_name, user_tables, user_map, base_url))
    return {"message": "Assignment messages started", "job_id": job_id, "total": len(user_tables)}


@router.get("/job/{job_id}")
async def get_job_status(job_id: str, admin=Depends(require_admin)):
    """Poll a background job's progress."""
    job = _jobs.get(job_id)
    if not job:
        return {"status": "not_found"}
    return job


@router.get("/status/{event_id}")
async def get_message_status(event_id: str, message_type: str = "all", admin=Depends(require_admin)):
    """Get WhatsApp message delivery status for an event, split by type."""
    query = {"event_id": event_id}
    if message_type != "all":
        query["message_type"] = message_type
    messages = await db.whatsapp_messages.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)

    user_ids = list({m['user_id'] for m in messages})
    user_map = await bulk_fetch_users(user_ids, enrich=False)
    for m in messages:
        u = user_map.get(m['user_id'])
        m['user_name'] = u.get('full_name', 'Unknown') if u else 'Unknown'
        m['user_phone'] = u.get('phone', '') if u else ''

    welcome_msgs = [m for m in messages if m.get('message_type') == 'welcome']
    assignment_msgs = [m for m in messages if m.get('message_type') == 'assignment']

    def summarize(msgs):
        return {
            "total": len(msgs),
            "sent": sum(1 for m in msgs if m['status'] == 'sent'),
            "failed": sum(1 for m in msgs if m['status'] == 'failed'),
            "messages": msgs,
        }

    return {
        "total": len(messages),
        "sent": sum(1 for m in messages if m['status'] == 'sent'),
        "failed": sum(1 for m in messages if m['status'] == 'failed'),
        "messages": messages,
        "welcome": summarize(welcome_msgs),
        "assignment": summarize(assignment_msgs),
    }


@router.post("/retry-failed/{event_id}")
async def retry_failed_messages(event_id: str, message_type: str = "welcome", template_name: str = "welcome", admin=Depends(require_admin)):
    """Retry failed messages as a background job."""
    failed = await db.whatsapp_messages.find(
        {"event_id": event_id, "message_type": message_type, "status": "failed"},
        {"_id": 0}
    ).to_list(5000)
    if not failed:
        return {"message": "No failed messages to retry", "retried": 0}

    user_ids = [m['user_id'] for m in failed]
    user_map = await bulk_fetch_users(user_ids, enrich=False)
    event = await db.events.find_one({"id": event_id}, {"_id": 0})

    # Re-use the welcome job for retries
    already_done = set()  # Don't skip any — these are all failed
    job_id = str(uuid.uuid4())[:8]
    asyncio.create_task(_run_welcome_job(job_id, event_id, event.get('name', '') if event else '', template_name, user_ids, user_map, already_done))
    return {"message": "Retry started", "job_id": job_id, "total": len(failed)}
