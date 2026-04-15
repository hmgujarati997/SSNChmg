import random
import time
from collections import defaultdict


def assign_tables(users, event, captains, categories, on_progress=None):
    """
    Smart seating algorithm for speed networking.
    Hard constraints:
      1. No two users who already met in a previous round at the same table
      2. No two users from the same SUB-CATEGORY at one table
    Soft constraints (best effort):
      3. No two users from the same CATEGORY or CLASH GROUP at one table
    """
    total_tables = event['total_tables']
    chairs_per_table = event['chairs_per_table']
    total_vacant = event.get('vacant_seats_per_table', 0)
    total_rounds = event['total_rounds']

    captain_tables = {c['table_number']: c for c in captains}

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

    # Build clash group map: category_id -> clash_group (or category_id if no group set)
    cat_to_clash = {}
    for cat in categories:
        cid = cat.get('id', '')
        group = cat.get('clash_group', '').strip()
        cat_to_clash[cid] = group if group else cid

    user_cats = {u['id']: u.get('category_id', '') for u in users}
    user_subcats = {u['id']: u.get('subcategory_id', '') for u in users}
    # Map user -> clash_group for category-level clash checking
    user_clash = {uid: cat_to_clash.get(cat_id, cat_id) for uid, cat_id in user_cats.items()}

    captain_cats = {}
    captain_subcats = {}
    captain_ids = {}
    captain_clash = {}
    for t, c in captain_tables.items():
        cat_id = c.get('category_id', '')
        captain_cats[t] = cat_id
        captain_subcats[t] = c.get('subcategory_id', '')
        captain_ids[t] = c['user_id']
        captain_clash[t] = cat_to_clash.get(cat_id, cat_id)

    assignments = {}
    met_pairs = set()

    # Scale attempts based on user count to avoid timeouts
    max_attempts = min(200, max(20, 5000 // max(len(users), 1)))
    algo_start = time.time()
    max_algo_time = 45  # seconds total budget

    for round_num in range(1, total_rounds + 1):
        if on_progress:
            on_progress(round_num, "attempt")
        best_assignment = None
        best_score = float('inf')

        for attempt in range(max_attempts):
            if time.time() - algo_start > max_algo_time:
                break
            seed = round_num * 137 + 42 + attempt * 7919 + random.randint(0, 99999)
            result, remeets, subcat_v, cat_v = _assign_round(
                users, total_tables, table_capacity, user_cats, user_subcats,
                captain_cats, captain_subcats, captain_ids, met_pairs, seed,
                user_clash, captain_clash
            )
            score = remeets * 10000 + subcat_v * 100 + cat_v
            if score < best_score:
                best_score = score
                best_assignment = result
            if score == 0:
                break

        if best_score > 0 and best_assignment and (time.time() - algo_start < max_algo_time):
            if on_progress:
                on_progress(round_num, "optimizing")
            time_left = max_algo_time - (time.time() - algo_start)
            optimized, remeets, subcat_v, cat_v = _swap_optimize(
                best_assignment, total_tables, table_capacity, user_cats,
                user_subcats, captain_cats, captain_subcats, captain_ids, met_pairs,
                max_iterations=500, time_limit=min(time_left * 0.5, 10),
                user_clash=user_clash, captain_clash=captain_clash
            )
            opt_score = remeets * 10000 + subcat_v * 100 + cat_v
            if opt_score <= best_score:
                best_assignment = optimized

        # Record met pairs for this round
        for t in range(1, total_tables + 1):
            all_at_table = list(best_assignment[t])
            if t in captain_ids:
                all_at_table.append(captain_ids[t])
            for i in range(len(all_at_table)):
                for j in range(i + 1, len(all_at_table)):
                    met_pairs.add(frozenset({all_at_table[i], all_at_table[j]}))

        assignments[round_num] = best_assignment
        if on_progress:
            on_progress(round_num, "done")

    return assignments


def _assign_round(users, total_tables, table_capacity, user_cats, user_subcats,
                   captain_cats, captain_subcats, captain_ids, met_pairs, seed,
                   user_clash=None, captain_clash=None):
    """Assign users for a single round. Uses clash groups for category separation."""
    if user_clash is None:
        user_clash = user_cats
    if captain_clash is None:
        captain_clash = {t: captain_cats.get(t, '') for t in captain_cats}

    random.seed(seed)

    subcat_count = defaultdict(int)
    for u in users:
        sc = user_subcats.get(u['id'], '')
        if sc:
            subcat_count[sc] += 1

    shuffled = users.copy()
    random.shuffle(shuffled)
    # Most constrained first: users with popular subcategories, then popular categories
    cat_count = defaultdict(int)
    for u in users:
        c = user_cats.get(u['id'], '')
        if c:
            cat_count[c] += 1
    shuffled.sort(key=lambda u: (
        -subcat_count.get(user_subcats.get(u['id'], ''), 0),
        -cat_count.get(user_cats.get(u['id'], ''), 0)
    ))

    round_tables = {t: [] for t in range(1, total_tables + 1)}
    table_clash_groups = {t: set() for t in range(1, total_tables + 1)}
    table_subcats = {t: set() for t in range(1, total_tables + 1)}
    table_met_users = {t: set() for t in range(1, total_tables + 1)}

    for t in range(1, total_tables + 1):
        if t in captain_clash and captain_clash[t]:
            table_clash_groups[t].add(captain_clash[t])
        if t in captain_subcats and captain_subcats[t]:
            table_subcats[t].add(captain_subcats[t])
        if t in captain_ids:
            for pair in met_pairs:
                if captain_ids[t] in pair:
                    other = next(iter(pair - {captain_ids[t]}))
                    table_met_users[t].add(other)

    assigned = set()

    # Phase 1: All constraints (no re-meeting, no subcat clash, no clash group clash)
    for user in shuffled:
        uid = user['id']
        if uid in assigned:
            continue
        t = _find_best_table(uid, round_tables, total_tables, table_capacity,
                             table_clash_groups, table_subcats, table_met_users,
                             user_clash, user_subcats, met_pairs,
                             strict_category=True)
        if t is not None:
            _place_user(uid, t, round_tables, table_clash_groups, table_subcats,
                       table_met_users, user_clash, user_subcats, met_pairs)
            assigned.add(uid)

    # Phase 2: Relax clash group constraint (still no re-meeting, no subcat clash)
    for user in shuffled:
        uid = user['id']
        if uid in assigned:
            continue
        t = _find_best_table(uid, round_tables, total_tables, table_capacity,
                             table_clash_groups, table_subcats, table_met_users,
                             user_clash, user_subcats, met_pairs,
                             strict_category=False)
        if t is not None:
            _place_user(uid, t, round_tables, table_clash_groups, table_subcats,
                       table_met_users, user_clash, user_subcats, met_pairs)
            assigned.add(uid)

    # Phase 3: Relax subcategory (still NO re-meetings)
    for user in shuffled:
        uid = user['id']
        if uid in assigned:
            continue
        best_t = None
        best_score = float('-inf')
        for t in range(1, total_tables + 1):
            if len(round_tables[t]) >= table_capacity.get(t, 0):
                continue
            if uid in table_met_users[t]:
                continue
            has_met = any(frozenset({uid, o}) in met_pairs for o in round_tables[t])
            if t in captain_ids and frozenset({uid, captain_ids[t]}) in met_pairs:
                has_met = True
            if has_met:
                continue
            score = -len(round_tables[t])
            if score > best_score:
                best_score = score
                best_t = t
        if best_t is not None:
            _place_user(uid, best_t, round_tables, table_clash_groups, table_subcats,
                       table_met_users, user_clash, user_subcats, met_pairs)
            assigned.add(uid)

    # Phase 4: Absolute last resort (re-meetings allowed only if no other option)
    for user in shuffled:
        uid = user['id']
        if uid in assigned:
            continue
        for t in range(1, total_tables + 1):
            if len(round_tables[t]) < table_capacity.get(t, 0):
                _place_user(uid, t, round_tables, table_clash_groups, table_subcats,
                           table_met_users, user_clash, user_subcats, met_pairs)
                assigned.add(uid)
                break

    remeets, subcat_v, cat_v = _count_violations(round_tables, total_tables, user_clash, user_subcats,
                                           captain_clash, captain_subcats, captain_ids, met_pairs)
    return round_tables, remeets, subcat_v, cat_v


def _find_best_table(uid, round_tables, total_tables, table_capacity,
                      table_clash_groups, table_subcats, table_met_users,
                      user_clash, user_subcats, met_pairs, strict_category=True):
    u_clash = user_clash.get(uid, '')
    u_subcat = user_subcats.get(uid, '')
    best_t = None
    best_score = float('-inf')

    for t in range(1, total_tables + 1):
        if len(round_tables[t]) >= table_capacity.get(t, 0):
            continue

        # HARD: No duplicate subcategory
        if u_subcat and u_subcat in table_subcats[t]:
            continue

        # HARD: No re-meeting
        if uid in table_met_users[t]:
            continue
        has_met = False
        for other_uid in round_tables[t]:
            if frozenset({uid, other_uid}) in met_pairs:
                has_met = True
                break
        if has_met:
            continue

        # SOFT: Clash group check
        if strict_category and u_clash and u_clash in table_clash_groups[t]:
            continue

        score = 0
        if not strict_category and u_clash and u_clash in table_clash_groups[t]:
            score -= 50
        score -= len(round_tables[t])

        if score > best_score:
            best_score = score
            best_t = t

    return best_t


def _place_user(uid, t, round_tables, table_clash_groups, table_subcats,
                table_met_users, user_clash, user_subcats, met_pairs):
    round_tables[t].append(uid)
    u_clash = user_clash.get(uid, '')
    u_subcat = user_subcats.get(uid, '')
    if u_clash:
        table_clash_groups[t].add(u_clash)
    if u_subcat:
        table_subcats[t].add(u_subcat)


def _count_violations(round_tables, total_tables, user_clash, user_subcats,
                       captain_clash, captain_subcats, captain_ids, met_pairs):
    """Count re-meeting violations, subcategory violations, and clash group clashes separately."""
    remeets = 0
    subcat_v = 0
    cat_v = 0
    for t in range(1, total_tables + 1):
        # Subcategory violations (skip empty)
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
                subcat_v += cnt - 1

        # Clash group clashes (skip empty)
        clashes = []
        if t in captain_clash and captain_clash[t]:
            clashes.append(captain_clash[t])
        for uid in round_tables[t]:
            c = user_clash.get(uid, '')
            if c:
                clashes.append(c)
        for c in set(clashes):
            cnt = clashes.count(c)
            if cnt > 1:
                cat_v += cnt - 1

        # Re-meeting violations
        all_ids = list(round_tables[t])
        if t in captain_ids:
            all_ids.append(captain_ids[t])
        for i in range(len(all_ids)):
            for j in range(i + 1, len(all_ids)):
                if frozenset({all_ids[i], all_ids[j]}) in met_pairs:
                    remeets += 1
    return remeets, subcat_v, cat_v


def _swap_optimize(round_tables, total_tables, table_capacity, user_cats, user_subcats,
                    captain_cats, captain_subcats, captain_ids, met_pairs, max_iterations=500, time_limit=10,
                    user_clash=None, captain_clash=None):
    """Try swapping users between tables to eliminate re-meetings first, then subcategory, then clash group violations."""
    uc = user_clash if user_clash is not None else user_cats
    cc = captain_clash if captain_clash is not None else captain_cats

    def score():
        rm, sv, cv = _count_violations(round_tables, total_tables, uc, user_subcats,
                                    cc, captain_subcats, captain_ids, met_pairs)
        return rm * 10000 + sv * 100 + cv, rm, sv, cv

    current_score, current_rm, current_sv, current_cv = score()
    start = time.time()

    for _ in range(max_iterations):
        if current_score == 0 or (time.time() - start) > time_limit:
            break

        improved = False
        for t1 in range(1, total_tables + 1):
            if improved or (time.time() - start) > time_limit:
                break
            for idx1, uid1 in enumerate(round_tables[t1]):
                if improved or (time.time() - start) > time_limit:
                    break
                for t2 in range(t1 + 1, total_tables + 1):
                    if improved or (time.time() - start) > time_limit:
                        break
                    for idx2, uid2 in enumerate(round_tables[t2]):
                        round_tables[t1][idx1] = uid2
                        round_tables[t2][idx2] = uid1
                        new_score, new_rm, new_sv, new_cv = score()
                        if new_score < current_score:
                            current_score = new_score
                            current_rm = new_rm
                            current_sv = new_sv
                            current_cv = new_cv
                            improved = True
                            break
                        else:
                            round_tables[t1][idx1] = uid1
                            round_tables[t2][idx2] = uid2

    return round_tables, current_rm, current_sv, current_cv
