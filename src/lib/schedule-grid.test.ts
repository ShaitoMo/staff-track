import {
    buildOpenRegisterRows,
    buildRoleRows,
    indexWeek,
    rolesOnRegisters,
    slotKey,
    slotsForClient,
    summarizeWeek,
    toOtherShifts,
    toStaff,
} from '@/lib/schedule-grid';
import { CoverageRequirementView } from '@/types/coverage-requirement';
import { Register } from '@/types/register';
import { Role } from '@/types/role';
import { ShiftView } from '@/types/shift';
import { ShiftPeriodView } from '@/types/shift-period';
import { SafeUser } from '@/types/user';

const WEEK = '2026-09-28';
const cashier = { roleId: 1, name: 'Cashier' };
const stocker = { roleId: 2, name: 'Stocker' };

function period(periodId: number, name: string): ShiftPeriodView {
    return { periodId, branchId: 1, name, defaultStart: '08:00', defaultEnd: '16:00', sortOrder: periodId };
}

const morning = period(10, 'Morning');
const evening = period(11, 'Evening');

function user(userId: number, name: string, roleId: number, isActive = true): SafeUser {
    return { userId, name, roleId, isActive, phone: String(userId), createdAt: new Date(0) };
}

const ali = user(1, 'Ali', cashier.roleId);
const sara = user(2, 'Sara', cashier.roleId);
const hadi = user(3, 'Hadi', stocker.roleId);
const users = [ali, sara, hadi];

const till1: Register = { registerId: 5, branchId: 1, name: 'Till 1' };

function shift(shiftId: number, userId: number, date: string, periodId: number | null, registerId: number | null = null): ShiftView {
    return {
        shift_id: shiftId,
        user_id: userId,
        branch_id: 1,
        register_id: registerId,
        period_id: periodId,
        shift_date: date,
        start_time: '08:00',
        end_time: '16:00',
        created_by: 9,
        created_at: new Date(0),
        updated_at: new Date(0),
    };
}

function requirement(role: typeof cashier, p: ShiftPeriodView, requiredCount: number): CoverageRequirementView {
    return { requirementId: role.roleId * 100 + p.periodId, branchId: 1, requiredCount, role, period: p };
}

/** The builders read a shared index, as ScheduleSection builds it; these keep each test to one call. */
function roleRows(
    shifts: ShiftView[],
    roles: Role[],
    periods: ShiftPeriodView[],
    requirements: CoverageRequirementView[],
    registers: Register[] = [],
) {
    return buildRoleRows(shifts, indexWeek(shifts, users, registers), roles, periods, requirements, WEEK);
}

function openRegisterRows(shifts: ShiftView[], registers: Register[], periods: ShiftPeriodView[]) {
    return buildOpenRegisterRows(indexWeek(shifts, users, registers), registers, periods, WEEK);
}

describe('indexWeek', () => {
    it('groups period shifts by slot, sorted by name, and leaves custom-hours shifts out', () => {
        const week = indexWeek(
            [shift(1, sara.userId, WEEK, morning.periodId, till1.registerId), shift(2, ali.userId, WEEK, morning.periodId), shift(3, hadi.userId, WEEK, null)],
            users,
            [till1],
        );

        expect(slotsForClient(week)).toEqual({
            [slotKey(WEEK, morning.periodId)]: [
                { shiftId: 2, userId: ali.userId, name: 'Ali', registerId: null, registerName: null },
                { shiftId: 1, userId: sara.userId, name: 'Sara', registerId: till1.registerId, registerName: 'Till 1' },
            ],
        });
    });
});

describe('buildRoleRows', () => {
    it('makes a row per required role × period and counts people against the requirement each day', () => {
        const rows = roleRows(
            [shift(1, ali.userId, WEEK, morning.periodId, till1.registerId)],
            [cashier, stocker],
            [morning, evening],
            [requirement(cashier, morning, 2)],
            [till1],
        );

        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ roleName: 'Cashier', periodName: 'Morning' });
        expect(rows[0].cells).toHaveLength(7);
        expect(rows[0].cells[0]).toEqual({
            date: WEEK,
            people: [{ shiftId: 1, userId: ali.userId, name: 'Ali', registerId: till1.registerId, registerName: 'Till 1' }],
            required: 2,
            scheduled: 1,
            shortfall: 1,
        });
        expect(rows[0].cells[1]).toMatchObject({ people: [], scheduled: 0, shortfall: 2 });
    });

    it('adds a row for a role scheduled in a period with no requirement, needing 0', () => {
        const rows = roleRows([shift(1, hadi.userId, WEEK, evening.periodId)], [cashier, stocker], [morning, evening], []);

        expect(rows.map((row) => `${row.roleName}/${row.periodName}`)).toEqual(['Stocker/Evening']);
        expect(rows[0].cells[0]).toMatchObject({ required: 0, scheduled: 1, shortfall: 0 });
    });

    it('puts each person under their own role only, and counts a person twice in a slot once', () => {
        const rows = roleRows(
            [shift(1, ali.userId, WEEK, morning.periodId), shift(2, ali.userId, WEEK, morning.periodId), shift(3, hadi.userId, WEEK, morning.periodId)],
            [cashier, stocker],
            [morning],
            [requirement(cashier, morning, 1), requirement(stocker, morning, 1)],
        );

        const [cashierRow, stockerRow] = rows;
        expect(cashierRow.cells[0]).toMatchObject({ scheduled: 1, shortfall: 0 });
        expect(cashierRow.cells[0].people.map((person) => person.shiftId)).toEqual([1, 2]);
        expect(stockerRow.cells[0].people.map((person) => person.name)).toEqual(['Hadi']);
    });

    it("orders rows period first, so each period's roles sit together", () => {
        const rows = roleRows(
            [],
            [stocker, cashier],
            [morning, evening],
            [requirement(cashier, morning, 1), requirement(stocker, morning, 1), requirement(cashier, evening, 1)],
        );

        expect(rows.map((row) => `${row.periodName}/${row.roleName}`)).toEqual(['Morning/Cashier', 'Morning/Stocker', 'Evening/Cashier']);
    });

    it('leaves out roles not passed in, e.g. owner hidden from a manager', () => {
        expect(roleRows([shift(1, hadi.userId, WEEK, morning.periodId)], [cashier], [morning], [])).toEqual([]);
    });
});

describe('buildOpenRegisterRows', () => {
    const till2: Register = { registerId: 6, branchId: 1, name: 'Till 2' };

    it('lists, per period and day, only the registers nobody works', () => {
        const rows = openRegisterRows(
            [shift(1, sara.userId, WEEK, morning.periodId, till1.registerId), shift(2, ali.userId, WEEK, morning.periodId)],
            [till2, till1],
            [morning, evening],
        );

        expect(rows.map((row) => row.periodId)).toEqual([morning.periodId, evening.periodId]);
        expect(rows[0].cells[0]).toEqual({ date: WEEK, open: [{ registerId: 6, name: 'Till 2' }], crowded: [] });
        expect(rows[1].cells[0].open.map((seat) => seat.name)).toEqual(['Till 1', 'Till 2']);
    });

    it('flags a register with more than one person, keeping them so one can be moved', () => {
        const rows = openRegisterRows(
            [shift(1, sara.userId, WEEK, morning.periodId, till1.registerId), shift(2, ali.userId, WEEK, morning.periodId, till1.registerId)],
            [till1],
            [morning],
        );

        expect(rows[0].cells[0].open).toEqual([]);
        expect(rows[0].cells[0].crowded).toEqual([
            { registerId: 5, name: 'Till 1', people: [expect.objectContaining({ name: 'Ali' }), expect.objectContaining({ name: 'Sara' })] },
        ]);
    });
});

describe('rolesOnRegisters', () => {
    it('lists each role with someone on a register once, ignoring shifts without one', () => {
        const shifts = [
            shift(1, ali.userId, WEEK, morning.periodId, till1.registerId),
            shift(2, sara.userId, WEEK, evening.periodId, till1.registerId),
            shift(3, hadi.userId, WEEK, morning.periodId),
        ];

        expect(rolesOnRegisters(shifts, indexWeek(shifts, users, [till1]))).toEqual([cashier.roleId]);
        expect(rolesOnRegisters([], indexWeek([], users, []))).toEqual([]);
    });
});

describe('toOtherShifts / toStaff', () => {
    it('lists only custom-hours shifts as other shifts', () => {
        const shifts = [shift(1, ali.userId, WEEK, null), shift(2, sara.userId, WEEK, morning.periodId)];

        expect(toOtherShifts(shifts, indexWeek(shifts, users, []))).toEqual([
            { shiftId: 1, name: 'Ali', date: WEEK, startTime: '08:00', endTime: '16:00' },
        ]);
    });

    it('offers only active people, sorted by name', () => {
        expect(toStaff([sara, user(4, 'Zed', 1, false), ali]).map((member) => member.name)).toEqual(['Ali', 'Sara']);
    });
});

describe('summarizeWeek', () => {
    it('counts short role cells, missing people, and empty or crowded register cells', () => {
        const shifts = [
            shift(1, ali.userId, WEEK, morning.periodId, till1.registerId),
            shift(2, sara.userId, WEEK, morning.periodId, till1.registerId),
        ];

        expect(
            summarizeWeek(
                roleRows(shifts, [cashier], [morning], [requirement(cashier, morning, 3)], [till1]),
                openRegisterRows(shifts, [till1], [morning]),
            ),
        ).toEqual({
            // Monday is 2 of 3 (short 1); the other six days are 0 of 3 (short 3 each)
            shortSlots: 7,
            peopleShort: 1 + 6 * 3,
            unstaffedRegisters: 6,
            crowdedRegisters: 1,
        });
    });

    it('is all zeros for an empty grid', () => {
        expect(summarizeWeek([], [])).toEqual({ shortSlots: 0, peopleShort: 0, unstaffedRegisters: 0, crowdedRegisters: 0 });
    });
});
