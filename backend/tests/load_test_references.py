"""Load test: 1000 concurrent reference submissions."""
import asyncio
import aiohttp
import time
import sys

API_URL = "https://speed-match-live.preview.emergentagent.com"
TOKEN = sys.argv[1]
EVENT_ID = sys.argv[2]
TO_USER_ID = sys.argv[3]
TOTAL = 1000
CONCURRENCY = 200  # Max simultaneous HTTP connections

results = {"success": 0, "fail": 0, "errors": []}

async def send_reference(session, sem, i):
    async with sem:
        try:
            payload = {
                "event_id": EVENT_ID,
                "to_user_id": TO_USER_ID,
                "round_number": 1,
                "table_number": 1,
                "contact_name": f"LoadTest Person {i}",
                "contact_phone": f"900000{i:04d}",
            }
            async with session.post(
                f"{API_URL}/api/user/references",
                json=payload,
                headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                if resp.status == 200:
                    results["success"] += 1
                else:
                    body = await resp.text()
                    results["fail"] += 1
                    if len(results["errors"]) < 5:
                        results["errors"].append(f"#{i} HTTP {resp.status}: {body[:100]}")
        except Exception as e:
            results["fail"] += 1
            if len(results["errors"]) < 5:
                results["errors"].append(f"#{i} Exception: {str(e)[:100]}")

async def main():
    sem = asyncio.Semaphore(CONCURRENCY)
    connector = aiohttp.TCPConnector(limit=CONCURRENCY)
    async with aiohttp.ClientSession(connector=connector) as session:
        print(f"Firing {TOTAL} references with concurrency={CONCURRENCY}...")
        start = time.time()
        tasks = [send_reference(session, sem, i) for i in range(TOTAL)]
        await asyncio.gather(*tasks)
        elapsed = time.time() - start

    print(f"\n=== RESULTS ===")
    print(f"Total: {TOTAL}")
    print(f"Success: {results['success']}")
    print(f"Failed: {results['fail']}")
    print(f"Time: {elapsed:.2f}s")
    print(f"Rate: {TOTAL/elapsed:.0f} req/sec")
    if results["errors"]:
        print(f"\nSample errors:")
        for e in results["errors"]:
            print(f"  {e}")

asyncio.run(main())
