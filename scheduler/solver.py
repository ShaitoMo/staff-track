"""CP-SAT model for one branch's week: who fills which open slot.

Stateless and DB-free. Next.js works out what is still needed and who is already busy, and this
only decides the assignments. Coverage always outranks fairness: the shortfall weight is larger
than any fairness spread the model can produce. Scheduling rules arrive already flattened: slots a
person may not take, and pairs never on the same day and period. Both are hard limits, so a rule
leaves a slot short rather than bend.
"""

from collections import defaultdict
from datetime import date

from ortools.sat.python import cp_model
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

TIME_LIMIT_SECONDS = 10.0
MAX_SHIFTS_PER_WEEK = 7


class CamelModel(BaseModel):
    # unknown fields are refused, so an older solver can't quietly drop a rule it doesn't know
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


class Slot(CamelModel):
    slot_id: int
    date: date
    period_id: int
    role_id: int
    needed: int = Field(ge=1)


class Employee(CamelModel):
    user_id: int
    role_id: int
    # shifts they already hold this week, at any branch; counts toward the cap and fairness
    existing_shifts: int = Field(default=0, ge=0)
    # slots this person may not take: a day they're already booked anywhere, a period they don't work
    blocked_slot_ids: list[int] = []


class SolveRequest(CamelModel):
    max_shifts_per_week: int = Field(ge=1, le=MAX_SHIFTS_PER_WEEK)
    slots: list[Slot]
    employees: list[Employee]
    # pairs never on the same day and period, whatever their roles
    keep_apart: list[tuple[int, int]] = []


class Assignment(CamelModel):
    slot_id: int
    user_id: int


class Unfilled(CamelModel):
    slot_id: int
    missing: int


class SolveResponse(CamelModel):
    assignments: list[Assignment]
    unfilled: list[Unfilled]


class NoSolutionError(Exception):
    """CP-SAT ran out of time before finding any assignment at all."""


def solve(request: SolveRequest) -> SolveResponse:
    model = cp_model.CpModel()
    slots = sorted(request.slots, key=lambda slot: slot.slot_id)
    employees = sorted(request.employees, key=lambda employee: employee.user_id)

    # a variable per (person, slot) only where the role matches and the slot isn't blocked, indexed
    # every way the constraints need as it's made. Employees outer, so each slot's list stays in
    # user_id order.
    by_slot: dict[int, list[tuple[int, cp_model.IntVar]]] = defaultdict(list)
    by_user: dict[int, list[cp_model.IntVar]] = defaultdict(list)
    by_day: dict[tuple[int, date], list[cp_model.IntVar]] = defaultdict(list)
    by_shift: dict[tuple[int, date, int], list[cp_model.IntVar]] = defaultdict(list)
    for employee in employees:
        blocked = set(employee.blocked_slot_ids)
        for slot in slots:
            if employee.role_id == slot.role_id and slot.slot_id not in blocked:
                var = model.new_bool_var(f"x_{employee.user_id}_{slot.slot_id}")
                by_slot[slot.slot_id].append((employee.user_id, var))
                by_user[employee.user_id].append(var)
                by_day[(employee.user_id, slot.date)].append(var)
                by_shift[(employee.user_id, slot.date, slot.period_id)].append(var)

    # coverage, never over: whatever isn't filled is shortfall
    short: dict[int, cp_model.IntVar] = {}
    for slot in slots:
        short[slot.slot_id] = model.new_int_var(0, slot.needed, f"short_{slot.slot_id}")
        model.add(sum(var for _, var in by_slot[slot.slot_id]) + short[slot.slot_id] == slot.needed)

    # one shift a day, across every period and role
    for day_vars in by_day.values():
        model.add(sum(day_vars) <= 1)

    # keep apart: at most one of the pair in any (day, period), across every role's slots there
    shifts = {(slot.date, slot.period_id) for slot in slots}
    for a, b in request.keep_apart:
        for day, period_id in shifts:
            a_vars = by_shift.get((a, day, period_id))
            b_vars = by_shift.get((b, day, period_id))
            if a_vars and b_vars:
                model.add(sum(a_vars) + sum(b_vars) <= 1)

    load: dict[int, cp_model.LinearExpr] = {}
    by_role: dict[int, list[int]] = defaultdict(list)

    for employee in employees:
        new_shifts = sum(by_user[employee.user_id])
        model.add(new_shifts <= max(0, request.max_shifts_per_week - employee.existing_shifts))
        load[employee.user_id] = employee.existing_shifts + new_shifts
        by_role[employee.role_id].append(employee.user_id)

    # fairness: within each role, keep everyone's week (existing + new) close together. No load can
    # pass the biggest existing count plus a full week, so that bounds high/low and every spread.
    max_load = max((employee.existing_shifts for employee in employees), default=0) + MAX_SHIFTS_PER_WEEK
    spreads = []
    for role_id, user_ids in by_role.items():
        high = model.new_int_var(0, max_load, f"high_{role_id}")
        low = model.new_int_var(0, max_load, f"low_{role_id}")
        for user_id in user_ids:
            model.add(high >= load[user_id])
            model.add(low <= load[user_id])
        spreads.append(high - low)

    # strictly more than the largest total spread, so one more filled slot always wins
    coverage_weight = max_load * len(by_role) + 1
    model.minimize(coverage_weight * sum(short.values()) + sum(spreads))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = TIME_LIMIT_SECONDS
    # one worker and a fixed seed: the same week in gives the same proposal out
    solver.parameters.num_workers = 1
    solver.parameters.random_seed = 1
    status = solver.solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        raise NoSolutionError(solver.status_name(status))

    return SolveResponse(
        # slot order, then user order within a slot
        assignments=[
            Assignment(slot_id=slot.slot_id, user_id=user_id)
            for slot in slots
            for user_id, var in by_slot[slot.slot_id]
            if solver.value(var)
        ],
        unfilled=[
            Unfilled(slot_id=slot_id, missing=solver.value(var))
            for slot_id, var in short.items()
            if solver.value(var) > 0
        ],
    )
