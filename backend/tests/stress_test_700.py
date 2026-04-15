"""Stress test: 700 concurrent users punching references in ~1 second."""
import asyncio
import aiohttp
import time
import json
import sys

API = 'http://localhost:8001'
EVENT_ID = '44f1f94d-0865-486a-b6e9-c0dcd0723a6a'
CONCURRENT = 700


async def login_user(session, phone):
    """Login a user and return token."""
    try:
        async with session.post(f'{API}/api/auth/user/login',
                                json={'phone': phone, 'password': phone},
                                timeout=aiohttp.ClientTimeout(total=30)) as r:
            data = await r.json()
            return data.get('token')
    except:
        return None


async def send_reference(session, token, to_user_id, idx):
    """Send a single reference."""
    try:
        async with session.post(
            f'{API}/api/user/references',
            headers={'Authorization': f'Bearer {token}'},
            json={
                'event_id': EVENT_ID,
                'to_user_id': to_user_id,
                'round_number': 1,
                'table_number': 1,
                'notes': f'Stress ref {idx}',
                'contact_name': f'Contact {idx}',
                'contact_phone': f'9990{idx:06d}',
            },
            timeout=aiohttp.ClientTimeout(total=30)
        ) as r:
            status = r.status
            body = await r.json()
            return status, body.get('message', str(body))
    except Exception as e:
        return 0, str(e)


async def main():
    connector = aiohttp.TCPConnector(limit=0, force_close=False)
    async with aiohttp.ClientSession(connector=connector) as session:
        # Step 1: Get admin token and fetch users
        print("Fetching users...")
        async with session.post(f'{API}/api/auth/admin/login',
                                json={'email': 'admin@ssnc.com', 'password': 'admin123'}) as r:
            admin_token = (await r.json())['token']

        async with session.get(f'{API}/api/admin/users',
                               headers={'Authorization': f'Bearer {admin_token}'}) as r:
            all_users = await r.json()

        # Pick 700 users with phones (for login)
        users = [u for u in all_users if u.get('phone')][:CONCURRENT]
        print(f"Found {len(users)} users for testing")

        # Step 2: Login all 700 users in batches of 100
        print(f"Logging in {len(users)} users (batches of 100)...")
        login_start = time.time()
        all_tokens = []
        for batch_start in range(0, len(users), 100):
            batch = users[batch_start:batch_start+100]
            login_tasks = [login_user(session, u['phone']) for u in batch]
            batch_tokens = await asyncio.gather(*login_tasks)
            for i, t in enumerate(batch_tokens):
                all_tokens.append((t, batch[i]))
        login_time = time.time() - login_start
        valid_tokens = [(t, u) for t, u in all_tokens if t]
        print(f"Logged in {len(valid_tokens)}/{len(users)} in {login_time:.1f}s")

        if len(valid_tokens) < 100:
            print("Too few logins succeeded, aborting")
            return

        # Step 3: Each user sends a reference to the NEXT user in the list
        print(f"\nFiring {len(valid_tokens)} concurrent references...")
        ref_tasks = []
        for i, (token, user) in enumerate(valid_tokens):
            # Send reference to next user in circular fashion
            target_idx = (i + 1) % len(valid_tokens)
            target_id = valid_tokens[target_idx][1]['id']
            ref_tasks.append(send_reference(session, token, target_id, i))

        fire_start = time.time()
        results = await asyncio.gather(*ref_tasks)
        fire_time = time.time() - fire_start

        # Step 4: Count results
        success = sum(1 for s, _ in results if s == 200)
        fail = sum(1 for s, _ in results if s != 200)
        errors = [(s, m) for s, m in results if s != 200]

        print(f"\n{'='*50}")
        print(f"RESULTS: {success}/{len(results)} succeeded in {fire_time:.2f}s")
        print(f"Rate: {success/fire_time:.0f} refs/sec")
        print(f"Failures: {fail}")
        if errors[:5]:
            print(f"Sample errors: {errors[:5]}")
        print(f"{'='*50}")


if __name__ == '__main__':
    asyncio.run(main())
