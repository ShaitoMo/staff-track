import { branchRoster, myShifts } from '@/lib/staff-schedule';
import { BranchScheduleShift, BranchScheduleView } from '@/types/shift';

const MON = '2026-09-28';
const TUE = '2026-09-29';

function shift(shiftId: number, userId: number, name: string, date: string, periodId: number | null, startTime = '08:00'): BranchScheduleShift {
    return {
        shift_id: shiftId,
        user_id: userId,
        user_name: name,
        role_name: 'cashier',
        shift_date: date,
        start_time: startTime,
        end_time: '16:00',
        period_id: periodId,
        register_name: null,
    };
}

function schedule(branchId: number, branchName: string, shifts: BranchScheduleShift[]): BranchScheduleView {
    return {
        branch_id: branchId,
        branch_name: branchName,
        periods: [{ period_id: 1, name: 'Morning' }, { period_id: 2, name: 'Evening' }],
        shifts,
    };
}

describe('myShifts', () => {
    it("keeps only the viewer's shifts, across branches, in the order they happen", () => {
        const main = schedule(1, 'Main', [shift(1, 7, 'Nina', TUE, 1), shift(2, 8, 'Bob', MON, 1)]);
        const downtown = schedule(2, 'Downtown', [shift(3, 7, 'Nina', MON, 2, '16:00')]);

        expect(myShifts([main, downtown], 7)).toEqual([
            expect.objectContaining({ shiftId: 3, branchName: 'Downtown', periodName: 'Evening' }),
            expect.objectContaining({ shiftId: 1, branchName: 'Main', periodName: 'Morning' }),
        ]);
    });
});

describe('branchRoster', () => {
    it('groups each day by period in branch order, drops empty periods, and puts custom hours last', () => {
        const roster = branchRoster(
            schedule(1, 'Main', [
                shift(1, 8, 'Zed', MON, 2, '16:00'),
                shift(2, 9, 'Bob', MON, null, '10:00'),
                shift(3, 10, 'Amy', MON, 2, '16:00'),
                shift(4, 11, 'Cal', MON, 99),
            ]),
            [MON, TUE],
        );

        expect(roster[0].groups.map((group) => [group.name, group.people.map((person) => person.name)])).toEqual([
            ['Evening', ['Amy', 'Zed']],
            [null, ['Cal', 'Bob']],
        ]);
        expect(roster[1]).toEqual({ date: TUE, groups: [] });
    });
});
