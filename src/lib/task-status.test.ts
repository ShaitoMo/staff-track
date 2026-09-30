import { TaskStatus } from '@prisma/client';
import { canTransition, assertTransition, STATUS_TRANSITIONS } from '@/lib/task-status';
import { InvalidStatusTransitionError } from '@/exceptions/invalid-status-transition-error';

const ALL_STATUSES: TaskStatus[] = [
    TaskStatus.pending,
    TaskStatus.completed,
    TaskStatus.verified,
    TaskStatus.rejected,
];

/** The complete set of legal moves. Anything not listed here must be refused. */
const LEGAL: ReadonlyArray<[TaskStatus, TaskStatus]> = [
    [TaskStatus.pending, TaskStatus.completed],
    [TaskStatus.completed, TaskStatus.verified],
    [TaskStatus.completed, TaskStatus.rejected],
];

describe('status transitions', () => {
    it.each(LEGAL)('allows %s -> %s', (from, to) => {
        expect(canTransition(from, to)).toBe(true);
        expect(() => assertTransition(from, to)).not.toThrow();
    });

    it('refuses every pair that is not in the map', () => {
        const legalKeys = new Set(LEGAL.map(([from, to]) => `${from}->${to}`));

        for (const from of ALL_STATUSES) {
            for (const to of ALL_STATUSES) {
                if (legalKeys.has(`${from}->${to}`)) continue;

                expect(canTransition(from, to)).toBe(false);
                expect(() => assertTransition(from, to)).toThrow(InvalidStatusTransitionError);
            }
        }
    });

    it('treats verified and rejected as terminal', () => {
        expect(STATUS_TRANSITIONS[TaskStatus.verified]).toEqual([]);
        expect(STATUS_TRANSITIONS[TaskStatus.rejected]).toEqual([]);
    });

    it('refuses same-status writes, including re-completing a completed instance', () => {
        expect(canTransition(TaskStatus.completed, TaskStatus.completed)).toBe(false);
        expect(canTransition(TaskStatus.pending, TaskStatus.pending)).toBe(false);
    });

    it('refuses skipping completion', () => {
        expect(canTransition(TaskStatus.pending, TaskStatus.verified)).toBe(false);
        expect(canTransition(TaskStatus.pending, TaskStatus.rejected)).toBe(false);
    });

    it('refuses reopening a reviewed instance', () => {
        expect(canTransition(TaskStatus.verified, TaskStatus.pending)).toBe(false);
        expect(canTransition(TaskStatus.rejected, TaskStatus.completed)).toBe(false);
    });

    it('carries the attempted move on the error', () => {
        expect.assertions(2);

        try {
            assertTransition(TaskStatus.verified, TaskStatus.pending);
        } catch (error) {
            expect((error as InvalidStatusTransitionError).from).toBe(TaskStatus.verified);
            expect((error as InvalidStatusTransitionError).to).toBe(TaskStatus.pending);
        }
    });

    it('covers every status as a key, so a new enum value cannot be silently unhandled', () => {
        expect(Object.keys(STATUS_TRANSITIONS).sort()).toEqual([...ALL_STATUSES].sort());
    });
});
