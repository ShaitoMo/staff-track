import { Prisma } from '@prisma/client';

// The module builds a PrismaPg adapter at import time; the tests below never reach the database,
// so an empty stand-in keeps the suite from needing DATABASE_URL.
jest.mock('@/lib/db', () => ({ db: { shift: { findMany: jest.fn() } } }));

import { db } from '@/lib/db';
import { ShiftRepository, OverlapQuery, RegisterOverlapQuery } from '@/repository/shift-repository';

/** `buildOverlapWhere` is private; element access reaches it without widening the repository API. */
const buildOverlapWhere = (query: OverlapQuery | RegisterOverlapQuery): Prisma.ShiftWhereInput =>
    ShiftRepository['buildOverlapWhere'](query);

const QUERY: OverlapQuery = {
    userId: 7,
    shiftDate: new Date('2026-08-13T00:00:00Z'),
    startTime: new Date('1970-01-01T09:00:00Z'),
    endTime: new Date('1970-01-01T17:00:00Z'),
};

describe('buildOverlapWhere — half-open interval', () => {
    it('uses strict lt/gt, so a back-to-back handover is not a clash', () => {
        const where = buildOverlapWhere(QUERY);

        expect(where.startTime).toEqual({ lt: QUERY.endTime });
        expect(where.endTime).toEqual({ gt: QUERY.startTime });
    });

    it('scopes to the same user and the same day', () => {
        const where = buildOverlapWhere(QUERY);

        expect(where.userId).toBe(QUERY.userId);
        expect(where.shiftDate).toBe(QUERY.shiftDate);
    });

    it('scopes to the register instead when asked about a register', () => {
        const { shiftDate, startTime, endTime } = QUERY;
        const where = buildOverlapWhere({ registerId: 4, shiftDate, startTime, endTime });

        expect(where.registerId).toBe(4);
        expect(where.userId).toBeUndefined();
        expect(where.startTime).toEqual({ lt: QUERY.endTime });
    });

    it('does not exclude any shift when nothing is being edited', () => {
        expect(buildOverlapWhere(QUERY).shiftId).toBeUndefined();
    });

    it('excludes the shift being edited, which always overlaps itself', () => {
        const where = buildOverlapWhere({ ...QUERY, excludeShiftId: 42 });

        expect(where.shiftId).toEqual({ not: 42 });
    });
});

describe('getShifts — date window', () => {
    it('includes both ends, so a shift on the `to` day is returned', async () => {
        const findMany = db.shift.findMany as jest.Mock;
        findMany.mockResolvedValue([]);
        const from = new Date('2026-09-30T00:00:00Z');
        const to = new Date('2026-10-03T00:00:00Z');

        await ShiftRepository.getShifts({ branchId: 1, from, to });

        expect(findMany.mock.calls[0][0].where.shiftDate).toEqual({ gte: from, lte: to });
    });
});
