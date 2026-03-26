"""Database query helpers to avoid N+1 query patterns."""
from database import db


async def enrich_users_with_categories(users):
    """Bulk-enrich a list of user dicts with category_name and subcategory_name."""
    if not users:
        return users
    cat_ids = {u['category_id'] for u in users if u.get('category_id')}
    sub_ids = {u['subcategory_id'] for u in users if u.get('subcategory_id')}
    cat_map = {}
    sub_map = {}
    if cat_ids:
        cats = await db.categories.find({"id": {"$in": list(cat_ids)}}, {"_id": 0}).to_list(500)
        cat_map = {c['id']: c['name'] for c in cats}
    if sub_ids:
        subs = await db.subcategories.find({"id": {"$in": list(sub_ids)}}, {"_id": 0}).to_list(500)
        sub_map = {s['id']: s['name'] for s in subs}
    for u in users:
        u['category_name'] = cat_map.get(u.get('category_id'), '')
        u['subcategory_name'] = sub_map.get(u.get('subcategory_id'), '')
    return users


async def bulk_fetch_users(user_ids, enrich=True):
    """Fetch multiple users by IDs in a single query, optionally enriching with categories."""
    if not user_ids:
        return {}
    users = await db.users.find({"id": {"$in": list(user_ids)}}, {"_id": 0, "password_hash": 0}).to_list(len(user_ids))
    if enrich:
        await enrich_users_with_categories(users)
    return {u['id']: u for u in users}
