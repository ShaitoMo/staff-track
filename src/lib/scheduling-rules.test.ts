import { blockedSlotIds, isAllowedIn, partnersOf, resolveRestrictions } from "@/lib/scheduling-rules";

const MON = "2026-11-02";
const TUE = "2026-11-03";
const MORNING = 1;
const EVENING = 2;

const booked = (user_id: number, shift_date: string, period_id: number | null) => ({ user_id, shift_date, period_id });

describe("partnersOf", () => {
    it("finds partners on either side of a pair, including people outside the list", () => {
        expect(partnersOf([[1, 2], [3, 1], [4, 5]], [1])).toEqual([2, 3]);
    });

    it("lists a partner shared by several people once", () => {
        expect(partnersOf([[1, 9], [2, 9]], [1, 2])).toEqual([9]);
    });
});

describe("resolveRestrictions", () => {
    const rules = {
        keepApart: [[1, 2]] as [number, number][],
        periodLimits: [{ userId: 1, periodIds: [EVENING] }, { userId: 3, periodIds: [] }],
    };

    it("gives each person their periods, null meaning any, and their partners", () => {
        const restrictions = resolveRestrictions([1, 2, 3], rules, []);

        expect(restrictions.get(1)).toEqual({ allowedPeriodIds: [EVENING], keepApartWith: [2], partnerShifts: [] });
        expect(restrictions.get(2)).toEqual({ allowedPeriodIds: null, keepApartWith: [1], partnerShifts: [] });
        expect(restrictions.get(3)?.allowedPeriodIds).toBeNull();
    });

    it("turns a partner's booked shifts into cells the other can't take, ignoring shifts with no period", () => {
        const restrictions = resolveRestrictions([1], rules, [booked(2, MON, MORNING), booked(2, TUE, null), booked(7, TUE, EVENING)]);

        expect(restrictions.get(1)?.partnerShifts).toEqual([{ shiftDate: MON, periodId: MORNING }]);
    });
});

describe("isAllowedIn / blockedSlotIds", () => {
    const slots = [
        { slotId: 0, date: MON, periodId: MORNING },
        { slotId: 1, date: MON, periodId: EVENING },
        { slotId: 2, date: TUE, periodId: MORNING },
    ];

    it("allows everything with no rules", () => {
        expect(blockedSlotIds({ allowedPeriodIds: null, keepApartWith: [], partnerShifts: [], busyDates: [] }, slots)).toEqual([]);
    });

    it("blocks periods outside the limit", () => {
        expect(blockedSlotIds({ allowedPeriodIds: [EVENING], keepApartWith: [], partnerShifts: [], busyDates: [] }, slots)).toEqual([0, 2]);
    });

    it("blocks only the exact day and period a partner works", () => {
        const restriction = { allowedPeriodIds: null, keepApartWith: [9], partnerShifts: [{ shiftDate: MON, periodId: MORNING }], busyDates: [] };

        expect(blockedSlotIds(restriction, slots)).toEqual([0]);
        expect(isAllowedIn(restriction, { shiftDate: TUE, periodId: MORNING })).toBe(true);
    });

    it("blocks every slot on a day the person is already booked", () => {
        expect(blockedSlotIds({ allowedPeriodIds: null, keepApartWith: [], partnerShifts: [], busyDates: [MON] }, slots)).toEqual([0, 1]);
    });
});
