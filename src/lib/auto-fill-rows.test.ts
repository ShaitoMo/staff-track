import { countChanges, groupByDay, ProposalRow, shortReason, swapCandidates, toRows } from "@/lib/auto-fill-rows";
import type { ProposalEmployee } from "@/types/schedule-builder";
import type { ShiftPeriodView } from "@/types/shift-period";

const CASHIER = 1;
const STOCKER = 2;
const MON = "2026-11-02";
const TUE = "2026-11-03";

const employee = (userId: number, extra: Partial<ProposalEmployee> = {}): ProposalEmployee => ({
    userId,
    name: `P${userId}`,
    roleId: CASHIER,
    busyDates: [],
    existingShifts: 0,
    allowedPeriodIds: null,
    keepApartWith: [],
    partnerShifts: [],
    ...extra,
});
const row = (id: number, userId: number, shiftDate = MON, periodId = 1): ProposalRow => ({
    id,
    userId,
    roleId: CASHIER,
    periodId,
    shiftDate,
});
const ids = (people: ProposalEmployee[]) => people.map((person) => person.userId);

describe("swapCandidates", () => {
    it("offers the current person plus same-role people free that day", () => {
        const employees = [employee(1), employee(2), employee(3, { roleId: STOCKER }), employee(4, { busyDates: [MON] })];
        const target = row(0, 1);

        expect(ids(swapCandidates({ employees, maxShiftsPerWeek: 6 }, [target], target))).toEqual([1, 2]);
    });

    it("leaves out someone already on another row that day", () => {
        const employees = [employee(1), employee(2)];
        const rows = [row(0, 1, MON, 1), row(1, 2, MON, 2)];

        expect(ids(swapCandidates({ employees, maxShiftsPerWeek: 6 }, rows, rows[0]))).toEqual([1]);
    });

    it("leaves out someone the swap would take over the weekly cap, counting other branches", () => {
        const employees = [employee(1), employee(2, { existingShifts: 1 }), employee(3, { existingShifts: 2 })];
        const rows = [row(0, 1, MON), row(1, 2, TUE)];

        // P2: 1 existing + Tuesday = 2, at the cap; P3: 2 existing, at the cap
        expect(ids(swapCandidates({ employees, maxShiftsPerWeek: 2 }, rows, rows[0]))).toEqual([1]);
    });

    it("doesn't count the target row against its own person", () => {
        const employees = [employee(1, { existingShifts: 1 })];
        const rows = [row(0, 1)];

        expect(ids(swapCandidates({ employees, maxShiftsPerWeek: 2 }, rows, rows[0]))).toEqual([1]);
    });

    it("leaves out someone limited to other periods", () => {
        const employees = [employee(1), employee(2, { allowedPeriodIds: [2] }), employee(3, { allowedPeriodIds: [1, 2] })];
        const target = row(0, 1, MON, 1);

        expect(ids(swapCandidates({ employees, maxShiftsPerWeek: 6 }, [target], target))).toEqual([1, 3]);
    });

    it("leaves out someone whose keep-apart partner is on another row of the same day and period", () => {
        const employees = [employee(1), employee(2), employee(3, { keepApartWith: [2] })];
        const rows = [row(0, 1, MON, 1), row(1, 2, MON, 1)];

        expect(ids(swapCandidates({ employees, maxShiftsPerWeek: 6 }, rows, rows[0]))).toEqual([1]);
    });

    it("keeps someone whose partner works the same day in another period", () => {
        const employees = [employee(1), employee(2), employee(3, { keepApartWith: [2] })];
        const rows = [row(0, 1, MON, 1), row(1, 2, MON, 2)];

        expect(ids(swapCandidates({ employees, maxShiftsPerWeek: 6 }, rows, rows[0]))).toEqual([1, 3]);
    });

    it("leaves out someone whose partner is already booked there", () => {
        const employees = [employee(1), employee(2, { keepApartWith: [9], partnerShifts: [{ shiftDate: MON, periodId: 1 }] })];
        const target = row(0, 1, MON, 1);

        expect(ids(swapCandidates({ employees, maxShiftsPerWeek: 6 }, [target], target))).toEqual([1]);
    });
});

describe("groupByDay", () => {
    const periods = [
        { periodId: 1, name: "Morning" },
        { periodId: 2, name: "Evening" },
    ] as ShiftPeriodView[];

    it("orders days, keeps the schedule's period order, and drops empty periods", () => {
        const rows = toRows([
            { userId: 1, roleId: CASHIER, periodId: 2, shiftDate: TUE },
            { userId: 2, roleId: CASHIER, periodId: 1, shiftDate: MON },
        ]);
        const unfilled = [{ shiftDate: TUE, periodId: 1, roleId: STOCKER, missing: 1 }];

        const days = groupByDay(rows, unfilled, periods);

        expect(days.map((d) => [d.date, d.periods.map((p) => p.period.periodId)])).toEqual([
            [MON, [1]],
            [TUE, [1, 2]],
        ]);
        expect(days[1].periods[0]).toMatchObject({ rows: [], unfilled });
    });

    it("drops a day once all its rows are removed and nothing is unfilled", () => {
        expect(groupByDay([], [], periods)).toEqual([]);
    });
});

describe("countChanges", () => {
    const assignments = [row(0, 1), row(1, 2, TUE)];

    it("counts removed and swapped rows", () => {
        expect(countChanges({ assignments }, toRows(assignments))).toBe(0);
        expect(countChanges({ assignments }, [{ ...row(0, 3) }])).toBe(2);
    });
});

describe("shortReason", () => {
    const slot = { shiftDate: MON, periodId: 1, roleId: CASHIER, missing: 1 };
    const reason = (employees: ProposalEmployee[], rows: ProposalRow[] = [], maxShiftsPerWeek = 6) =>
        shortReason({ employees, maxShiftsPerWeek }, rows, slot);

    it("says nobody holds the role", () => {
        expect(reason([employee(1, { roleId: STOCKER })])).toBe("noRole");
    });

    it("says everyone is working that day, booked or on another row", () => {
        expect(reason([employee(1, { busyDates: [MON] }), employee(2)], [row(0, 2, MON, 2)])).toBe("busy");
    });

    it("blames the cap, the rules, or both, for those free that day", () => {
        const capped = employee(1, { existingShifts: 2 });
        const limited = employee(2, { allowedPeriodIds: [2] });
        expect(reason([capped], [], 2)).toBe("cap");
        expect(reason([limited])).toBe("rule");
        expect(reason([capped, limited], [], 2)).toBe("capOrRule");
    });

    it("counts a keep-apart partner already on the slot as a rule", () => {
        expect(reason([employee(1, { keepApartWith: [2] }), employee(2, { busyDates: [] })], [row(0, 2)])).toBe("rule");
    });

    it("returns null when someone could still take it", () => {
        expect(reason([employee(1)])).toBeNull();
    });
});
