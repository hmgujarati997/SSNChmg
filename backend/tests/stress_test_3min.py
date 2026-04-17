"""Sustained 3-minute load test: every user pushes ~1 ref/sec for 180 seconds.
Captures success/failure, throughput, latency buckets, and backlog growth.

WA sends MUST be short-circuited (WA_TEST_MODE=1) before running."""
import asyncio
import aiohttp
import time
import sys

API = 'http://localhost:8001'
DURATION_SEC = 180
LOGIN_BATCH = 100
TARGET_USERS = 700  # will be clamped to available users


async def login_user(session, phone):
    try:
        async with session.post(
            f'{API}/api/auth/user/login',
            json={'phone': phone, 'password': phone},
            timeout=aiohttp.ClientTimeout(total=30),
        ) as r:
            d = await r.json()
            return d.get('token')
    except Exception:
        return None


async def send_reference(session, token, to_user_id, idx):
    t0 = time.monotonic()
    try:
        async with session.post(
            f'{API}/api/user/references',
            headers={'Authorization': f'Bearer {token}'},
            json={
                'event_id': EVENT_ID,
                'to_user_id': to_user_id,
                'round_number': 1,
                'table_number': 1,
                'notes': f'3min ref {idx}',
                'contact_name': f'Contact {idx}',
                'contact_phone': f'9990{idx:06d}',
            },
            timeout=aiohttp.ClientTimeout(total=20),
        ) as r:
            ok = r.status == 200
            await r.read()
            return ok, time.monotonic() - t0
    except Exception:
        return False, time.monotonic() - t0


async def get_active_event(session):
    async with session.post(f'{API}/api/auth/admin/login',
                            json={'email': 'admin@ssnc.com', 'password': 'admin123'}) as r:
        admin_token = (await r.json())['token']
    async with session.get(f'{API}/api/admin/events',
                           headers={'Authorization': f'Bearer {admin_token}'}) as r:
        events = await r.json()
    # Pick the first event that has assignments & references_enabled
    for e in events:
        if e.get('references_enabled') or e.get('status') == 'live':
            return admin_token, e['id']
    return admin_token, events[0]['id'] if events else None


async def ensure_refs_enabled(session, admin_token, event_id):
    """Toggle references_enabled = True if not already."""
    async with session.get(f'{API}/api/admin/events',
                           headers={'Authorization': f'Bearer {admin_token}'}) as r:
        events = await r.json()
    ev = next((e for e in events if e['id'] == event_id), None)
    if ev and not ev.get('references_enabled'):
        async with session.post(
            f'{API}/api/admin/events/{event_id}/round-control',
            headers={'Authorization': f'Bearer {admin_token}'},
            json={'action': 'toggle_references'},
        ) as r:
            await r.read()
        print('References enabled.')


async def main():
    connector = aiohttp.TCPConnector(limit=0, force_close=False)
    async with aiohttp.ClientSession(connector=connector) as session:
        admin_token, event_id = await get_active_event(session)
        globals()['EVENT_ID'] = event_id
        print(f'Using event: {event_id}')
        await ensure_refs_enabled(session, admin_token, event_id)

        async with session.get(f'{API}/api/admin/users',
                               headers={'Authorization': f'Bearer {admin_token}'}) as r:
            all_users = await r.json()
        users = [u for u in all_users if u.get('phone')][:TARGET_USERS]
        print(f'Found {len(users)} users with phones')

        # Batch login
        t0 = time.time()
        valid = []
        for bs in range(0, len(users), LOGIN_BATCH):
            batch = users[bs:bs + LOGIN_BATCH]
            toks = await asyncio.gather(*[login_user(session, u['phone']) for u in batch])
            for i, t in enumerate(toks):
                if t:
                    valid.append((t, batch[i]))
        print(f'Logged in {len(valid)}/{len(users)} in {time.time() - t0:.1f}s')
        if len(valid) < 100:
            print('Too few logins, aborting')
            return

        print(f"\n{'=' * 60}")
        print(f'SUSTAINED: {len(valid)} refs/sec for {DURATION_SEC}s')
        print(f'Expected total: {len(valid) * DURATION_SEC:,} references')
        print('=' * 60)

        total_ok = 0
        total_fail = 0
        total_sent = 0
        latencies = []
        ref_counter = 0
        start = time.time()

        for sec in range(DURATION_SEC):
            sec_start = time.time()
            tasks = []
            for i, (token, _u) in enumerate(valid):
                tgt = valid[(i + sec + 1) % len(valid)][1]['id']
                ref_counter += 1
                tasks.append(send_reference(session, token, tgt, ref_counter))
            results = await asyncio.gather(*tasks)

            sec_ok = sum(1 for ok, _ in results if ok)
            sec_fail = len(results) - sec_ok
            total_ok += sec_ok
            total_fail += sec_fail
            total_sent += len(results)
            latencies.extend(lat for _ok, lat in results)

            sec_elapsed = time.time() - sec_start
            elapsed = time.time() - start

            if (sec + 1) % 10 == 0 or sec == 0 or sec == DURATION_SEC - 1:
                sorted_lats = sorted(latencies[-len(valid) * 10:]) if latencies else [0]
                p50 = sorted_lats[len(sorted_lats) // 2] if sorted_lats else 0
                p95 = sorted_lats[int(len(sorted_lats) * 0.95)] if sorted_lats else 0
                print(f'[{sec + 1:3d}s] ok={sec_ok}/{len(results)} ({sec_elapsed:.2f}s) | '
                      f'total ok={total_ok:,}/{total_sent:,} | rate={total_ok / elapsed:.0f}/s | '
                      f'fails={total_fail} | p50={p50*1000:.0f}ms p95={p95*1000:.0f}ms')

            wait = max(0, 1.0 - sec_elapsed)
            if wait > 0:
                await asyncio.sleep(wait)

        dur = time.time() - start
        sorted_lats = sorted(latencies)
        p50 = sorted_lats[len(sorted_lats) // 2]
        p95 = sorted_lats[int(len(sorted_lats) * 0.95)]
        p99 = sorted_lats[int(len(sorted_lats) * 0.99)]

        print(f"\n{'=' * 60}")
        print('FINAL')
        print('=' * 60)
        print(f'Duration:       {dur:.1f}s')
        print(f'Total sent:     {total_sent:,}')
        print(f'Succeeded:      {total_ok:,}')
        print(f'Failed:         {total_fail:,}')
        print(f'Success rate:   {total_ok / total_sent * 100:.2f}%')
        print(f'Avg rate:       {total_ok / dur:.0f} refs/sec')
        print(f'Latency p50:    {p50 * 1000:.0f} ms')
        print(f'Latency p95:    {p95 * 1000:.0f} ms')
        print(f'Latency p99:    {p99 * 1000:.0f} ms')


if __name__ == '__main__':
    asyncio.run(main())
