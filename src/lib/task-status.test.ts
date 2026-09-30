import { TASK_STATUSES, TaskStatus } from '@/types/task-instance';
import { canTransition, assertTransition, STATUS_TRANSITIONS } from '@/lib/task-status';
import { InvalidStatusTransitionError } from '@/exceptions/invalid-status-transition-error';

/** The complete set of legal moves. Anything not listed here must be refused. */
const LEGAL: ReadonlyArray<[TaskStatus, TaskStatus]> = [
    ['pending', 'completed'],
    ['completed', 'verified'],
    ['completed', 'rejected'],
];

describe('status transitions', () => {
    it.each(LEGAL)('allows %s -> %s', (from, to) => {
        expect(canTransition(from, to)).toBe(true);
        expect(() => assertTransition(from, to)).not.toThrow();
    });

    it('refuses every pair that is not in the map', () => {
        const legalKeys = new Set(LEGAL.map(([from, to]) => `${from}->${to}`));

        for (const from of TASK_STATUSES) {
            for (const to of TASK_STATUSES) {
                if (legalKeys.has(`${from}->${to}`)) continue;

                expect(canTransition(from, to)).toBe(false);
                expect(() => assertTransition(from, to)).toThrow(InvalidStatusTransitionError);
            }
        }
    });

    it('treats verified and rejected as terminal', () => {
        expect(STATUS_TRANSITIONS.verified).toEqual([]);
        expect(STATUS_TRANSITIONS.rejected).toEqual([]);
    });

    it('refuses same-status writes, including re-completing a completed instance', () => {
        expect(canTransition('completed', 'completed')).toBe(false);
        expect(canTransition('pending', 'pending')).toBe(false);
    });

    it('refuses skipping completion', () => {
        expect(canTransition('pending', 'verified')).toBe(false);
        expect(canTransition('pending', 'rejected')).toBe(false);
    });

    it('refuses reopening a reviewed instance', () => {
        expect(canTransition('verified', 'pending')).toBe(false);
        expect(canTransition('rejected', 'completed')).toBe(false);
    });

    it('carries the attempted move on the error', () => {
        expect.assertions(2);

        try {
            assertTransition('verified', 'pending');
        } catch (error) {
            expect((error as InvalidStatusTransitionError).from).toBe('verified');
            expect((error as InvalidStatusTransitionError).to).toBe('pending');
        }
    });

    it('covers every status as a key, so a new enum value cannot be silently unhandled', () => {
        expect(Object.keys(STATUS_TRANSITIONS).sort()).toEqual([...TASK_STATUSES].sort());
    });
});
