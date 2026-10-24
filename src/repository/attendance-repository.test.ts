// The module builds a PrismaPg adapter at import time; these tests stand in for the one query they reach.
jest.mock('@/lib/db', () => ({ db: { attendance: { aggregate: jest.fn() } } }));

import { db } from '@/lib/db';
import { AttendanceRepository } from '@/repository/attendance-repository';

const aggregate = db.attendance.aggregate as jest.Mock;

function newest(clockIn: string | null, clockOut: string | null) {
    aggregate.mockResolvedValue({
        _max: { clockIn: clockIn && new Date(clockIn), clockOut: clockOut && new Date(clockOut) },
    });
}

beforeEach(() => {
    aggregate.mockReset();
});

describe('getLatestMachinePunch', () => {
    it("reads only the branch's machine and imported punches, never hand-entered ones", async () => {
        newest('2026-10-11T04:00:00.000Z', null);

        await AttendanceRepository.getLatestMachinePunch(4);

        expect(aggregate).toHaveBeenCalledWith(
            expect.objectContaining({ where: { branchId: 4, source: { not: 'manual' } } }),
        );
    });

    it('takes the later of the newest clock-in and the newest clock-out', async () => {
        newest('2026-10-11T04:00:00.000Z', '2026-10-10T20:00:00.000Z');
        expect(await AttendanceRepository.getLatestMachinePunch(4)).toEqual(new Date('2026-10-11T04:00:00.000Z'));

        newest('2026-10-10T05:00:00.000Z', '2026-10-10T20:00:00.000Z');
        expect(await AttendanceRepository.getLatestMachinePunch(4)).toEqual(new Date('2026-10-10T20:00:00.000Z'));
    });

    it('is null for a branch with no clock readings, and copes with only one end ever set', async () => {
        newest(null, null);
        expect(await AttendanceRepository.getLatestMachinePunch(4)).toBeNull();

        newest(null, '2026-10-10T20:00:00.000Z');
        expect(await AttendanceRepository.getLatestMachinePunch(4)).toEqual(new Date('2026-10-10T20:00:00.000Z'));
    });
});
