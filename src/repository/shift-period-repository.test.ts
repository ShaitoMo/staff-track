// The module builds a PrismaPg adapter at import time; these tests stand in for the one query they reach.
jest.mock('@/lib/db', () => ({ db: { shiftPeriod: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } } }));

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { DuplicatePeriodNameError } from '@/exceptions/duplicate-period-name-error';
import { ShiftPeriodRepository } from '@/repository/shift-period-repository';
import { ShiftPeriodInactiveError } from '@/exceptions/shift-period-inactive-error';
import { ShiftPeriodNotAtBranchError } from '@/exceptions/shift-period-not-at-branch-error';

/** `buildBranchWhere` is private; element access reaches it without widening the repository API. */
const buildBranchWhere = (branchId: number, includeInactive: boolean) =>
    ShiftPeriodRepository['buildBranchWhere'](branchId, includeInactive);

const findUnique = db.shiftPeriod.findUnique as jest.Mock;

const period = (overrides: Partial<{ branchId: number | null; active: boolean }>) => ({
    periodId: 3,
    branchId: 1,
    defaultStart: new Date('1970-01-01T07:00:00Z'),
    defaultEnd: new Date('1970-01-01T15:00:00Z'),
    active: true,
    ...overrides,
});

beforeEach(() => {
    findUnique.mockReset();
});

describe('buildBranchWhere', () => {
    it("lists a branch's own periods and the chain-wide ones, only those that are on", () => {
        expect(buildBranchWhere(1, false)).toEqual({ OR: [{ branchId: 1 }, { branchId: null }], active: true });
    });

    it('includes turned-off periods only when asked', () => {
        expect(buildBranchWhere(1, true)).toEqual({ OR: [{ branchId: 1 }, { branchId: null }] });
    });
});

describe('assertAtBranch', () => {
    it('accepts a period that is on, at this branch or chain-wide', async () => {
        findUnique.mockResolvedValueOnce(period({})).mockResolvedValueOnce(period({ branchId: null }));

        await expect(ShiftPeriodRepository.assertAtBranch(3, 1)).resolves.toMatchObject({ periodId: 3 });
        await expect(ShiftPeriodRepository.assertAtBranch(3, 1)).resolves.toMatchObject({ branchId: null });
    });

    it('refuses a turned-off period, so nothing new can be scheduled on it', async () => {
        findUnique.mockResolvedValue(period({ active: false }));

        await expect(ShiftPeriodRepository.assertAtBranch(3, 1)).rejects.toThrow(ShiftPeriodInactiveError);
    });

    it('reports another branch before the on/off state', async () => {
        findUnique.mockResolvedValue(period({ branchId: 2, active: false }));

        await expect(ShiftPeriodRepository.assertAtBranch(3, 1)).rejects.toThrow(ShiftPeriodNotAtBranchError);
    });
});

describe('a name already taken', () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
    });

    it('is a DuplicatePeriodNameError on create and on rename, not a raw Prisma error', async () => {
        (db.shiftPeriod.create as jest.Mock).mockRejectedValue(duplicate);
        (db.shiftPeriod.update as jest.Mock).mockRejectedValue(duplicate);
        const times = { defaultStart: new Date('1970-01-01T07:00:00Z'), defaultEnd: new Date('1970-01-01T15:00:00Z') };

        await expect(ShiftPeriodRepository.createPeriod({ branchId: 1, name: 'Morning', ...times })).rejects.toThrow(DuplicatePeriodNameError);
        await expect(ShiftPeriodRepository.updatePeriod(3, { name: 'Morning' })).rejects.toThrow(DuplicatePeriodNameError);
    });
});
