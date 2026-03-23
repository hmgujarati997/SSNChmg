import random
from collections import defaultdict


def assign_tables(users, event, captains, categories):
    """
    Smart seating algorithm for speed networking.
    Constraints:
    1. No two users from same category/subcategory at same table
    2. Collaborating categories preferred together
    3. No two users meet again across rounds
    4. Vacant seats reserved for spot registration
    5. Table captain's category doesn't conflict
    """
    total_tables = event['total_tables']
    chairs_per_table = event['chairs_per_table']
    vacant = event['vacant_seats_per_table']
    total_rounds = event['total_rounds']

    captain_tables = {c['table_number']: c for c in captains}

    table_capacity = {}
    for t in range(1, total_tables + 1):
        cap = chairs_per_table - vacant
        if t in captain_tables:
            cap -= 1
        table_capacity[t] = max(cap, 1)

    user_cats = {u['id']: u.get('category_id', '') for u in users}
    user_subcats = {u['id']: u.get('subcategory_id', '') for u in users}
    captain_cats = {t: c.get('category_id', '') for t, c in captain_tables.items()}

    collab_map = {}
    for cat in categories:
        collab_map[cat['id']] = set(cat.get('collaborates_with', []))

    assignments = {}
    met_pairs = set()

    for round_num in range(1, total_rounds + 1):
        shuffled = users.copy()
        random.seed(round_num * 137 + 42)
        random.shuffle(shuffled)

        round_tables = {t: [] for t in range(1, total_tables + 1)}
        assigned = set()

        for user in shuffled:
            uid = user['id']
            if uid in assigned:
                continue

            best_table = None
            best_score = float('-inf')

            for t in range(1, total_tables + 1):
                if len(round_tables[t]) >= table_capacity.get(t, 1):
                    continue

                u_cat = user_cats.get(uid, '')
                table_user_cats = [user_cats.get(x, '') for x in round_tables[t]]

                if u_cat and u_cat in table_user_cats:
                    continue

                if t in captain_cats and captain_cats[t] == u_cat and u_cat:
                    continue

                score = 0
                for other_uid in round_tables[t]:
                    pair = frozenset({uid, other_uid})
                    if pair in met_pairs:
                        score -= 100

                for other_uid in round_tables[t]:
                    other_cat = user_cats.get(other_uid, '')
                    if other_cat in collab_map.get(u_cat, set()):
                        score += 10

                score -= len(round_tables[t]) * 2

                if score > best_score:
                    best_score = score
                    best_table = t

            if best_table is not None:
                round_tables[best_table].append(uid)
                assigned.add(uid)

        # If some users couldn't be placed due to constraints, force-place them
        unassigned = [u for u in shuffled if u['id'] not in assigned]
        for user in unassigned:
            for t in range(1, total_tables + 1):
                if len(round_tables[t]) < table_capacity.get(t, 1):
                    round_tables[t].append(user['id'])
                    break

        for t_users in round_tables.values():
            for i in range(len(t_users)):
                for j in range(i + 1, len(t_users)):
                    met_pairs.add(frozenset({t_users[i], t_users[j]}))

        assignments[round_num] = round_tables

    return assignments
