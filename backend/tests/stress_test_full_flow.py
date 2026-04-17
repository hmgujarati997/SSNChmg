"""
Comprehensive Stress Test: 700 concurrent logins + 700 concurrent references
Tests backend stability under load with WA_TEST_MODE enabled (no real WA sends)
"""
import asyncio
import aiohttp
import time
import os

# Use public URL from environment or default
API = os.environ.get('REACT_APP_BACKEND_URL', 'https://clash-group.preview.emergentagent.com').rstrip('/')
EVENT_ID = '44f1f94d-0865-486a-b6e9-c0dcd0723a6a'
CONCURRENT = 700


async def login_user(session, phone, semaphore):
    """Login a user and return token."""
    async with semaphore:
        try:
            async with session.post(
                f'{API}/api/auth/user/login',
                json={'phone': phone},
                timeout=aiohttp.ClientTimeout(total=30)
            ) as r:
                if r.status == 200:
                    data = await r.json()
                    return data.get('token'), None
                else:
                    text = await r.text()
                    return None, f"Status {r.status}: {text[:100]}"
        except Exception as e:
            return None, str(e)


async def send_reference(session, token, to_user_id, idx, semaphore):
    """Send a single reference."""
    async with semaphore:
        try:
            async with session.post(
                f'{API}/api/user/references',
                headers={'Authorization': f'Bearer {token}'},
                json={
                    'event_id': EVENT_ID,
                    'to_user_id': to_user_id,
                    'round_number': 1,
                    'table_number': (idx % 66) + 1,  # Distribute across tables
                    'notes': f'Stress test ref {idx}',
                    'contact_name': f'Contact {idx}',
                    'contact_phone': f'9990{idx:06d}',
                },
                timeout=aiohttp.ClientTimeout(total=30)
            ) as r:
                status = r.status
                try:
                    body = await r.json()
                    msg = body.get('message', body.get('detail', str(body)))
                except:
                    msg = await r.text()
                return status, msg
        except Exception as e:
            return 0, str(e)


async def main():
    print("=" * 60)
    print("SSNC STRESS TEST - 700 Concurrent Logins + 700 References")
    print("=" * 60)
    print(f"API: {API}")
    print(f"Event ID: {EVENT_ID}")
    print()

    # Use connection pooling with limits
    connector = aiohttp.TCPConnector(limit=100, force_close=False)
    async with aiohttp.ClientSession(connector=connector) as session:
        
        # Step 1: Get admin token and fetch users
        print("[1/5] Fetching users via admin API...")
        try:
            async with session.post(
                f'{API}/api/auth/admin/login',
                json={'email': 'admin@ssnc.com', 'password': 'admin123'},
                timeout=aiohttp.ClientTimeout(total=30)
            ) as r:
                if r.status != 200:
                    print(f"Admin login failed: {await r.text()}")
                    return
                admin_data = await r.json()
                admin_token = admin_data['token']
        except Exception as e:
            print(f"Admin login error: {e}")
            return

        async with session.get(
            f'{API}/api/admin/users',
            headers={'Authorization': f'Bearer {admin_token}'},
            timeout=aiohttp.ClientTimeout(total=60)
        ) as r:
            all_users = await r.json()

        # Pick users with phones
        users = [u for u in all_users if u.get('phone')][:CONCURRENT]
        print(f"Found {len(users)} users with phone numbers")

        if len(users) < 100:
            print("ERROR: Not enough users for stress test")
            return

        # Step 2: Concurrent logins (700 in ~1 second)
        print(f"\n[2/5] Logging in {len(users)} users CONCURRENTLY...")
        login_semaphore = asyncio.Semaphore(200)  # Limit concurrent connections
        
        login_start = time.time()
        login_tasks = [login_user(session, u['phone'], login_semaphore) for u in users]
        login_results = await asyncio.gather(*login_tasks)
        login_time = time.time() - login_start

        valid_tokens = []
        login_errors = []
        for i, (token, error) in enumerate(login_results):
            if token:
                valid_tokens.append((token, users[i]))
            else:
                login_errors.append(error)

        login_success_rate = len(valid_tokens) / len(users) * 100
        print(f"Login Results: {len(valid_tokens)}/{len(users)} succeeded ({login_success_rate:.1f}%)")
        print(f"Login Time: {login_time:.2f}s ({len(users)/login_time:.0f} logins/sec)")
        if login_errors[:3]:
            print(f"Sample login errors: {login_errors[:3]}")

        if len(valid_tokens) < 100:
            print("ERROR: Too few logins succeeded, aborting")
            return

        # Step 3: Fire 700 concurrent references
        print(f"\n[3/5] Firing {len(valid_tokens)} concurrent references...")
        ref_semaphore = asyncio.Semaphore(200)
        
        ref_tasks = []
        for i, (token, user) in enumerate(valid_tokens):
            # Send reference to next user in circular fashion
            target_idx = (i + 1) % len(valid_tokens)
            target_id = valid_tokens[target_idx][1]['id']
            ref_tasks.append(send_reference(session, token, target_id, i, ref_semaphore))

        ref_start = time.time()
        ref_results = await asyncio.gather(*ref_tasks)
        ref_time = time.time() - ref_start

        # Count results
        success = sum(1 for s, _ in ref_results if s == 200)
        fail = sum(1 for s, _ in ref_results if s != 200)
        errors = [(s, m) for s, m in ref_results if s != 200]
        ref_success_rate = success / len(ref_results) * 100

        print(f"Reference Results: {success}/{len(ref_results)} succeeded ({ref_success_rate:.1f}%)")
        print(f"Reference Time: {ref_time:.2f}s ({success/ref_time:.0f} refs/sec)")
        if errors[:5]:
            print(f"Sample errors: {errors[:5]}")

        # Step 4: Check notification backlog
        print(f"\n[4/5] Checking notification queue/backlog...")
        async with session.get(
            f'{API}/api/admin/events/{EVENT_ID}',
            headers={'Authorization': f'Bearer {admin_token}'}
        ) as r:
            event_data = await r.json()
            print(f"Event references_enabled: {event_data.get('references_enabled')}")

        # Step 5: Verify backend is still responsive
        print(f"\n[5/5] Verifying backend stability...")
        stability_start = time.time()
        try:
            async with session.get(
                f'{API}/api/admin/events',
                headers={'Authorization': f'Bearer {admin_token}'},
                timeout=aiohttp.ClientTimeout(total=10)
            ) as r:
                if r.status == 200:
                    print(f"Backend responsive: GET /api/admin/events returned 200 in {time.time()-stability_start:.2f}s")
                else:
                    print(f"Backend issue: GET /api/admin/events returned {r.status}")
        except Exception as e:
            print(f"Backend stability check failed: {e}")

        # Final Summary
        print("\n" + "=" * 60)
        print("STRESS TEST SUMMARY")
        print("=" * 60)
        print(f"Login Success Rate: {login_success_rate:.1f}% ({len(valid_tokens)}/{len(users)})")
        print(f"Login Throughput: {len(users)/login_time:.0f} logins/sec")
        print(f"Reference Success Rate: {ref_success_rate:.1f}% ({success}/{len(ref_results)})")
        print(f"Reference Throughput: {success/ref_time:.0f} refs/sec")
        print(f"Total Test Time: {time.time() - login_start:.2f}s")
        
        # Pass/Fail criteria
        passed = login_success_rate >= 95 and ref_success_rate >= 95
        print(f"\nOVERALL: {'PASSED' if passed else 'FAILED'} (>95% success required)")
        print("=" * 60)

        return passed


if __name__ == '__main__':
    result = asyncio.run(main())
    exit(0 if result else 1)
