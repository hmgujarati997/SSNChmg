import random
from collections import defaultdict


def assign_tables(users, event, captains, categories):
    """
    Smart seating algorithm for speed networking.
    Hard constraints:
      1. No two users from the same SUB-CATEGORY at one table
      2. No two users who already met in a previous round at the same table
    Soft constraints (best effort):
      3. No two users from the same MAIN CATEGORY at one table
    """
    total_tables = event['total_tables']
    chairs_per_table = event['chairs_per_table']
    total_vacant = event.get('vacant_seats_per_table', 0)
    total_rounds = event['total_rounds']

    captain_tables = {c['table_number']: c for c in captains}

    # Distribute total vacant seats across tables (1 per table until exhausted)
    table_capacity = {}
    vacant_remaining = total_vacant
    for t in range(1, total_tables + 1):
        vacancy = 1 if vacant_remaining > 0 else 0
        if vacancy:
            vacant_remaining -= 1
        cap = chairs_per_table - vacancy
        if t in captain_tables:
            cap -= 1
        table_capacity[t] = max(cap, 0)

    user_cats = {u['id']: u.get('category_id', '') for u in users}
    user_subcats = {u['id']: u.get('subcategory_id', '') for u in users}

    # Captain info
    captain_cats = {}
    captain_subcats = {}
    captain_ids = {}
    for t, c in captain_tables.items():
        captain_cats[t] = c.get('category_id', '')
        captain_subcats[t] = c.get('subcategory_id', '')
        captain_ids[t] = c['user_id']

    assignments = {}
    met_pairs = set()

    for round_num in range(1, total_rounds + 1):
        best_assignment = None
        best_violations = float('inf')

        # Try multiple seeds, pick the one with fewest violations
        attempts = 3 if round_num > 1 else 1
        for attempt in range(attempts):
            seed = round_num * 137 + 42 + attempt * 7919
            result, violations = _assign_round(
                users, total_tables, table_capacity, user_cats, user_subcats,
                captain_cats, captain_subcats, captain_ids, met_pairs, seed
            )
            if violations < best_violations:
                best_violations = violations
                best_assignment = result
            if violations == 0:
                break

        # Swap optimization pass to resolve remaining violations
        if best_violations > 0:
            best_assignment, best_violations = _swap_optimize(
                best_assignment, total_tables, table_capacity, user_cats,
                user_subcats, captain_cats, captain_subcats, captain_ids, met_pairs
            )

        # Record met pairs for this round (including captains)
        for t in range(1, total_tables + 1):
            all_at_table = list(best_assignment[t])
            if t in captain_ids:
                all_at_table.append(captain_ids[t])
            for i in range(len(all_at_table)):
                for j in range(i + 1, len(all_at_table)):
                    met_pairs.add(frozenset({all_at_table[i], all_at_table[j]}))

        assignments[round_num] = best_assignment

    return assignments


def _assign_round(users, total_tables, table_capacity, user_cats, user_subcats,
                   captain_cats, captain_subcats, captain_ids, met_pairs, seed):
    """Assign users for a single round. Returns (tables_dict, violation_count)."""
    random.seed(seed)

    # Sort users by constraint difficulty: users with common subcategories first
    subcat_count = defaultdict(int)
    for u in users:
        sc = user_subcats.get(u['id'], '')
        if sc:
            subcat_count[sc] += 1

    shuffled = users.copy()
    random.shuffle(shuffled)
    # Most constrained first (users with popular subcategories)
    shuffled.sort(key=lambda u: -subcat_count.get(user_subcats.get(u['id'], ''), 0))

    round_tables = {t: [] for t in range(1, total_tables + 1)}
    table_cats = {t: set() for t in range(1, total_tables + 1)}
    table_subcats = {t: set() for t in range(1, total_tables + 1)}

    # Pre-populate with captain info
    for t in range(1, total_tables + 1):
        if t in captain_cats and captain_cats[t]:
            table_cats[t].add(captain_cats[t])
        if t in captain_subcats and captain_subcats[t]:
            table_subcats[t].add(captain_subcats[t])

    assigned = set()
    violations = 0

    # Phase 1: Place with all hard constraints + soft category constraint
    for user in shuffled:
        uid = user['id']
        if uid in assigned:
            continue
        t = _find_best_table(uid, round_tables, total_tables, table_capacity,
                             table_cats, table_subcats, user_cats, user_subcats,
                             captain_ids, met_pairs, strict_category=True)
        if t is not None:
            _place_user(uid, t, round_tables, table_cats, table_subcats, user_cats, user_subcats)
            assigned.add(uid)

    # Phase 2: Relax main category constraint
    for user in shuffled:
        uid = user['id']
        if uid in assigned:
            continue
        t = _find_best_table(uid, round_tables, total_tables, table_capacity,
                             table_cats, table_subcats, user_cats, user_subcats,
                             captain_ids, met_pairs, strict_category=False)
        if t is not None:
            _place_user(uid, t, round_tables, table_cats, table_subcats, user_cats, user_subcats)
            assigned.add(uid)

    # Phase 3: Force-place (relax subcategory but still avoid re-meetings)
    for user in shuffled:
        uid = user['id']
        if uid in assigned:
            continue
        best_t = None
        best_score = float('-inf')
        for t in range(1, total_tables + 1):
            if len(round_tables[t]) >= table_capacity.get(t, 0):
                continue
            has_met = any(frozenset({uid, o}) in met_pairs for o in round_tables[t])
            if t in captain_ids and frozenset({uid, captain_ids[t]}) in met_pairs:
                has_met = True
            if has_met:
                continue
            score = -len(round_tables[t])
            u_subcat = user_subcats.get(uid, '')
            if u_subcat and u_subcat in table_subcats[t]:
                score -= 20
                violations += 1
            if score > best_score:
                best_score = score
                best_t = t
        if best_t is None:
            # Absolute last resort
            for t in range(1, total_tables + 1):
                if len(round_tables[t]) < table_capacity.get(t, 0):
                    best_t = t
                    violations += 1
                    break
        if best_t is not None:
            _place_user(uid, best_t, round_tables, table_cats, table_subcats, user_cats, user_subcats)
            assigned.add(uid)

    return round_tables, violations


def _find_best_table(uid, round_tables, total_tables, table_capacity,
                      table_cats, table_subcats, user_cats, user_subcats,
                      captain_ids, met_pairs, strict_category=True):
    """Find the best table for a user respecting constraints."""
    u_cat = user_cats.get(uid, '')
    u_subcat = user_subcats.get(uid, '')
    best_t = None
    best_score = float('-inf')

    for t in range(1, total_tables + 1):
        if len(round_tables[t]) >= table_capacity.get(t, 0):
            continue

        # HARD: No duplicate subcategory
        if u_subcat and u_subcat in table_subcats[t]:
            continue

        # HARD: No re-meeting (check table users + captain)
        has_met = False
        for other_uid in round_tables[t]:
            if frozenset({uid, other_uid}) in met_pairs:
                has_met = True
                break
        if not has_met and t in captain_ids:
            if frozenset({uid, captain_ids[t]}) in met_pairs:
                has_met = True
        if has_met:
            continue

        # SOFT: Category check
        if strict_category and u_cat and u_cat in table_cats[t]:
            continue

        score = 0
        if not strict_category and u_cat and u_cat in table_cats[t]:
            score -= 50
        score -= len(round_tables[t])  # prefer emptier tables

        if score > best_score:
            best_score = score
            best_t = t

    return best_t


def _place_user(uid, t, round_tables, table_cats, table_subcats, user_cats, user_subcats):
    """Place a user at a table and update tracking sets."""
    round_tables[t].append(uid)
    u_cat = user_cats.get(uid, '')
    u_subcat = user_subcats.get(uid, '')
    if u_cat:
        table_cats[t].add(u_cat)
    if u_subcat:
        table_subcats[t].add(u_subcat)


def _swap_optimize(round_tables, total_tables, table_capacity, user_cats, user_subcats,
                    captain_cats, captain_subcats, captain_ids, met_pairs, max_iterations=200):
    """Try swapping users between tables to reduce violations."""
    table_cats = {t: set() for t in range(1, total_tables + 1)}
    table_subcats = {t: set() for t in range(1, total_tables + 1)}

    for t in range(1, total_tables + 1):
        if t in captain_cats and captain_cats[t]:
            table_cats[t].add(captain_cats[t])
        if t in captain_subcats and captain_subcats[t]:
            table_subcats[t].add(captain_subcats[t])
        for uid in round_tables[t]:
            c = user_cats.get(uid, '')
            s = user_subcats.get(uid, '')
            if c:
                table_cats[t].add(c)
            if s:
                table_subcats[t].add(s)

    def count_violations():
        v = 0
        for t in range(1, total_tables + 1):
            subcats = []
            if t in captain_subcats and captain_subcats[t]:
                subcats.append(captain_subcats[t])
            for uid in round_tables[t]:
                s = user_subcats.get(uid, '')
                if s:
                    subcats.append(s)
            for s in set(subcats):
                cnt = subcats.count(s)
                if cnt > 1:
                    v += cnt - 1
            # Check re-meetings
            all_ids = list(round_tables[t])
            if t in captain_ids:
                all_ids.append(captain_ids[t])
            for i in range(len(all_ids)):
                for j in range(i + 1, len(all_ids)):
                    if frozenset({all_ids[i], all_ids[j]}) in met_pairs:
                        v += 1
        return v

    current_v = count_violations()
    if current_v == 0:
        return round_tables, 0

    for _ in range(max_iterations):
        if current_v == 0:
            break

        # Find a violation and try to swap
        swapped = False
        for t1 in range(1, total_tables + 1):
            if swapped:
                break
            for idx1, uid1 in enumerate(round_tables[t1]):
                if swapped:
                    break
                u1_subcat = user_subcats.get(uid1, '')

                # Check if uid1 has a subcategory conflict or re-meeting at t1
                has_issue = False
                others_subcats = []
                if t1 in captain_subcats and captain_subcats[t1]:
                    others_subcats.append(captain_subcats[t1])
                for o in round_tables[t1]:
                    if o != uid1:
                        s = user_subcats.get(o, '')
                        if s:
                            others_subcats.append(s)
                if u1_subcat and u1_subcat in others_subcats:
                    has_issue = True

                all_at_t1 = [o for o in round_tables[t1] if o != uid1]
                if t1 in captain_ids:
                    all_at_t1.append(captain_ids[t1])
                for o in all_at_t1:
                    if frozenset({uid1, o}) in met_pairs:
                        has_issue = True
                        break

                if not has_issue:
                    continue

                # Try swapping uid1 with someone from another table
                for t2 in range(1, total_tables + 1):
                    if t2 == t1 or swapped:
                        continue
                    for idx2, uid2 in enumerate(round_tables[t2]):
                        # Simulate swap
                        round_tables[t1][idx1] = uid2
                        round_tables[t2][idx2] = uid1
                        new_v = count_violations()
                        if new_v < current_v:
                            current_v = new_v
                            swapped = True
                            break
                        else:
                            # Revert
                            round_tables[t1][idx1] = uid1
                            round_tables[t2][idx2] = uid2

    return round_tables, current_v
