"""Sustained load test: 700 users each punching 1 reference per second for 60 seconds.
Total: 700 refs/sec × 60 sec = 42,000 references while WhatsApp queue processes."""
import asyncio
import aiohttp
import time
import json

API = 'http://localhost:8001'
EVENT_ID = '44f1f94d-0865-486a-b6e9-c0dcd0723a6a'
USERS_COUNT = 700
DURATION_SEC = 60


async def login_user(session, phone):
    try:
        async with session.post(f'{API}/api/auth/user/login',
                                json={'phone': phone, 'password': phone},
                                timeout=aiohttp.ClientTimeout(total=30)) as r:
            data = await r.json()
            return data.get('token')
    except:
        return None


async def send_reference(session, token, to_user_id, idx):
    try:
        async with session.post(
            f'{API}/api/user/references',
            headers={'Authorization': f'Bearer {token}'},
            json={
                'event_id': EVENT_ID,
                'to_user_id': to_user_id,
                'round_number': 1,
                'table_number': 1,
                'notes': f'Sustained ref {idx}',
                'contact_name': f'Contact {idx}',
                'contact_phone': f'9990{idx:06d}',
            },
            timeout=aiohttp.ClientTimeout(total=15)
        ) as r:
            status = r.status
            return status == 200
    except:
        return False


async def main():
    connector = aiohttp.TCPConnector(limit=0, force_close=False)
    async with aiohttp.ClientSession(connector=connector) as session:
        # Step 1: Fetch users
        print("Fetching users...")
        async with session.post(f'{API}/api/auth/admin/login',
                                json={'email': 'admin@ssnc.com', 'password': 'admin123'}) as r:
            admin_token = (await r.json())['token']
        async with session.get(f'{API}/api/admin/users',
                               headers={'Authorization': f'Bearer {admin_token}'}) as r:
            all_users = await r.json()

        users = [u for u in all_users if u.get('phone')][:USERS_COUNT]
        print(f"Found {len(users)} users")

        # Step 2: Login all users in batches
        print(f"Logging in {len(users)} users...")
        login_start = time.time()
        valid_tokens = []
        for batch_start in range(0, len(users), 100):
            batch = users[batch_start:batch_start + 100]
            tasks = [login_user(session, u['phone']) for u in batch]
            results = await asyncio.gather(*tasks)
            for i, t in enumerate(results):
                if t:
                    valid_tokens.append((t, batch[i]))
        print(f"Logged in {len(valid_tokens)}/{len(users)} in {time.time() - login_start:.1f}s")

        if len(valid_tokens) < 100:
            print("Too few logins, aborting")
            return

        # Step 3: Sustained fire — 700 refs every second for 60 seconds
        print(f"\n{'='*60}")
        print(f"SUSTAINED LOAD: {len(valid_tokens)} refs/sec for {DURATION_SEC}s")
        print(f"Expected total: {len(valid_tokens) * DURATION_SEC:,} references")
        print(f"{'='*60}\n")

        total_success = 0
        total_fail = 0
        total_sent = 0
        ref_counter = 0
        start_time = time.time()

        for sec in range(DURATION_SEC):
            sec_start = time.time()

            # Fire all 700 references concurrently
            tasks = []
            for i, (token, user) in enumerate(valid_tokens):
                target_idx = (i + sec + 1) % len(valid_tokens)
                target_id = valid_tokens[target_idx][1]['id']
                ref_counter += 1
                tasks.append(send_reference(session, token, target_id, ref_counter))

            results = await asyncio.gather(*tasks)
            sec_success = sum(1 for r in results if r)
            sec_fail = sum(1 for r in results if not r)
            total_success += sec_success
            total_fail += sec_fail
            total_sent += len(results)

            sec_elapsed = time.time() - sec_start
            elapsed_total = time.time() - start_time

            # Print progress every 5 seconds
            if (sec + 1) % 5 == 0 or sec == 0:
                print(f"[{sec+1:3d}s] This sec: {sec_success}/{len(results)} ok ({sec_elapsed:.2f}s) | "
                      f"Total: {total_success:,}/{total_sent:,} | "
                      f"Rate: {total_success/elapsed_total:.0f}/s | "
                      f"Fails: {total_fail}")

            # Wait until the next second boundary
            wait = max(0, 1.0 - sec_elapsed)
            if wait > 0:
                await asyncio.sleep(wait)

        total_time = time.time() - start_time

        print(f"\n{'='*60}")
        print(f"FINAL RESULTS")
        print(f"{'='*60}")
        print(f"Duration:    {total_time:.1f}s")
        print(f"Total sent:  {total_sent:,}")
        print(f"Succeeded:   {total_success:,}")
        print(f"Failed:      {total_fail:,}")
        print(f"Success rate:{total_success/total_sent*100:.1f}%")
        print(f"Avg rate:    {total_success/total_time:.0f} refs/sec")
        print(f"{'='*60}")


if __name__ == '__main__':
    asyncio.run(main())
