# StaffTrack

An internal ops tool for a multi-branch market chain: scheduling, task tracking, attendance, and coverage across branches.

## Language

### People & Access

**User**:
A person with a login (phone + password) and exactly one Role. Covers the owner, managers, and staff (cashier, stocker, etc.) alike — there is no separate "employee" entity or flag anywhere in the system.
_Avoid_: Employee, Staff member (as a formal term)

**Role**:
A named permission level assigned to a User (e.g. owner, manager, cashier, stocker). Only `owner` and `manager` are enforced by name in code; every other role is treated uniformly as self-scoped, with no built-in distinction between e.g. cashier and stocker.
_Avoid_: Permission, Group

**Owner**:
The Role with unrestricted access across every Branch. Typically has no Branch link at all — the role itself is chain-wide, not tied to a location.
_Avoid_: Admin, Superuser

**Manager**:
The Role restricted to acting within their own linked Branch(es), via UserBranch.
_Avoid_: Supervisor

### Locations

**Branch**:
One physical market location, with its own Registers and staffing.
_Avoid_: Store, Site, Location (as a formal term)

**UserBranch**:
The link between a User and a Branch they work at, optionally carrying a machine clock-in ID used to match Attendance imports. A User can be linked to more than one Branch; the owner role typically has none.
_Avoid_: Assignment, Employment

**Register**:
A checkout/point-of-sale station within a Branch, referenced by Shifts.
_Avoid_: Till, POS terminal

### Scheduling

**Shift**:
A scheduled block of time a User is assigned to work at a specific Branch and Register, optionally linked to a Shift Period.
_Avoid_: Schedule entry

**Shift Period**:
A named, reusable time window (e.g. "Morning") that is either chain-wide or specific to one Branch, used to define Coverage Requirements.
_Avoid_: Time slot

**Coverage Requirement**:
The target headcount for a given Branch, Role, and Shift Period — the basis for detecting a Coverage Gap.
_Avoid_: Staffing target

**Coverage Gap**:
A computed shortfall where actual scheduled/attended headcount falls below a Branch's Coverage Requirement for a period. Not a stored record — derived on read.
_Avoid_: Understaffing

### Tasks

**Task**:
A definition of work to be done — one-off or recurring — assigned either to a specific User or to everyone holding a given Role at a Branch.
_Avoid_: To-do

**Task Instance**:
One dated occurrence of a Task, with its own status lifecycle (pending → completed → verified/rejected) and a required photo on completion.
_Avoid_: Occurrence, Checklist item

### Attendance

**Attendance**:
A recorded clock-in event for a User, sourced from a CSV/Excel import, a machine feed, or manual entry.
_Avoid_: Time log, Punch
