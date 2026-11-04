from collections import Counter

import pytest
from fastapi.testclient import TestClient

from solver import SolveRequest, solve

MON, TUE, WED = "2026-11-02", "2026-11-03", "2026-11-04"
CASHIER, STOCKER = 1, 2


def request(slots, employees, max_shifts=6, keep_apart=()):
    return SolveRequest.model_validate(
        {"maxShiftsPerWeek": max_shifts, "slots": slots, "employees": employees, "keepApart": list(keep_apart)}
    )


def slot(slot_id, day, role=CASHIER, period=1, needed=1):
    return {"slotId": slot_id, "date": day, "periodId": period, "roleId": role, "needed": needed}


def person(user_id, role=CASHIER, existing=0, blocked_slots=()):
    return {
        "userId": user_id,
        "roleId": role,
        "existingShifts": existing,
        "blockedSlotIds": list(blocked_slots),
    }


def taken(response):
    return {(a.slot_id, a.user_id) for a in response.assignments}


def test_only_matching_role_is_assigned():
    response = solve(request([slot(0, MON, role=STOCKER)], [person(1, role=CASHIER)]))

    assert response.assignments == []
    assert [(u.slot_id, u.missing) for u in response.unfilled] == [(0, 1)]


def test_one_shift_per_person_per_day_across_periods():
    response = solve(request([slot(0, MON, period=1), slot(1, MON, period=2)], [person(1)]))

    assert len(response.assignments) == 1
    assert sum(u.missing for u in response.unfilled) == 1


def test_weekly_cap_counts_existing_shifts():
    slots = [slot(0, MON), slot(1, TUE), slot(2, WED)]
    response = solve(request(slots, [person(1, existing=4)], max_shifts=6))

    assert len(response.assignments) == 2


def test_never_overstaffs():
    response = solve(request([slot(0, MON, needed=1)], [person(1), person(2), person(3)]))

    assert len(response.assignments) == 1
    assert response.unfilled == []


def test_spreads_shifts_evenly():
    slots = [slot(0, MON), slot(1, TUE), slot(2, WED)]
    response = solve(request(slots, [person(1), person(2), person(3)]))

    assert sorted(Counter(a.user_id for a in response.assignments).values()) == [1, 1, 1]


def test_fairness_counts_shifts_from_other_branches():
    response = solve(request([slot(0, MON)], [person(1, existing=3), person(2, existing=0)]))

    assert taken(response) == {(0, 2)}


def test_coverage_beats_fairness():
    # only person 1 can do Tuesday; leaving it empty would look "fairer" but coverage wins
    slots = [slot(0, MON), slot(1, TUE)]
    response = solve(request(slots, [person(1), person(2, blocked_slots=[1])]))

    assert response.unfilled == []
    assert (1, 1) in taken(response)


def test_reports_unfilled_when_demand_exceeds_staff():
    response = solve(request([slot(0, MON, needed=3)], [person(1), person(2)]))

    assert len(response.assignments) == 2
    assert [(u.slot_id, u.missing) for u in response.unfilled] == [(0, 1)]


def test_blocked_slot_is_never_assigned():
    response = solve(request([slot(0, MON)], [person(1, blocked_slots=[0]), person(2)]))

    assert taken(response) == {(0, 2)}


def test_blocked_slot_stays_short_rather_than_bend():
    response = solve(request([slot(0, MON)], [person(1, blocked_slots=[0])]))

    assert response.assignments == []
    assert [(u.slot_id, u.missing) for u in response.unfilled] == [(0, 1)]


def test_keep_apart_never_share_a_shift_even_across_roles():
    slots = [slot(0, MON, role=CASHIER), slot(1, MON, role=STOCKER)]
    response = solve(request(slots, [person(1, role=CASHIER), person(2, role=STOCKER)], keep_apart=[(1, 2)]))

    assert len(response.assignments) == 1
    assert sum(u.missing for u in response.unfilled) == 1


def test_keep_apart_may_work_the_same_day_in_other_periods():
    slots = [slot(0, MON, period=1), slot(1, MON, period=2)]
    response = solve(request(slots, [person(1), person(2)], keep_apart=[(1, 2)]))

    assert len(response.assignments) == 2
    assert response.unfilled == []


def test_keep_apart_leaves_room_for_someone_else():
    response = solve(request([slot(0, MON, needed=2)], [person(1), person(2), person(3)], keep_apart=[(1, 2)]))

    assert response.unfilled == []
    assert 3 in {user_id for _, user_id in taken(response)}


def test_keep_apart_with_unknown_person_is_ignored():
    response = solve(request([slot(0, MON)], [person(1)], keep_apart=[(1, 99)]))

    assert taken(response) == {(0, 1)}


def test_same_input_gives_same_output():
    slots = [slot(i, day) for i, day in enumerate([MON, TUE, WED])]
    people = [person(i) for i in range(1, 6)]

    assert solve(request(slots, people)) == solve(request(slots, people))


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("SCHEDULER_SECRET", "test-secret")
    import importlib

    import main

    return TestClient(importlib.reload(main).app)


def test_refuses_to_start_with_an_empty_secret(monkeypatch):
    monkeypatch.setenv("SCHEDULER_SECRET", "")
    import importlib

    with pytest.raises(RuntimeError):
        # a first import runs the check; if main is already loaded, the reload does
        import main

        importlib.reload(main)


def test_rejects_wrong_secret(client):
    body = {"maxShiftsPerWeek": 6, "slots": [], "employees": []}

    assert client.post("/solve", json=body, headers={"X-Scheduler-Secret": "nope"}).status_code == 401


def test_solves_over_http_in_camel_case(client):
    body = {"maxShiftsPerWeek": 6, "slots": [slot(0, MON)], "employees": [person(7)]}
    res = client.post("/solve", json=body, headers={"X-Scheduler-Secret": "test-secret"})

    assert res.status_code == 200
    assert res.json() == {"assignments": [{"slotId": 0, "userId": 7}], "unfilled": []}


def test_refuses_unknown_fields(client):
    # an out-of-date caller or solver must fail loudly, not drop a rule it doesn't understand
    body = {"maxShiftsPerWeek": 6, "slots": [], "employees": [], "onlyMornings": [1]}

    assert client.post("/solve", json=body, headers={"X-Scheduler-Secret": "test-secret"}).status_code == 422


def test_heavy_existing_week_stays_solvable():
    # someone already booked past a normal week elsewhere mustn't make the fairness bounds infeasible
    response = solve(request([slot(0, MON)], [person(1, existing=20), person(2)]))

    assert taken(response) == {(0, 2)}
