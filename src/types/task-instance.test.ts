import { UserTaskInstanceFiltersSchema } from '@/types/task-instance';

const accepts = (result: { success: boolean }) => result.success;

describe('UserTaskInstanceFiltersSchema — due_from/due_to must not be backwards', () => {
    it('accepts a normal range', () => {
        expect(
            accepts(UserTaskInstanceFiltersSchema.safeParse({ due_from: '2026-08-01', due_to: '2026-08-07' })),
        ).toBe(true);
    });

    it('accepts due_from and due_to on the same day', () => {
        expect(
            accepts(UserTaskInstanceFiltersSchema.safeParse({ due_from: '2026-08-01', due_to: '2026-08-01' })),
        ).toBe(true);
    });

    it('rejects due_to before due_from', () => {
        const result = UserTaskInstanceFiltersSchema.safeParse({
            due_from: '2026-08-07',
            due_to: '2026-08-01',
        });

        expect(accepts(result)).toBe(false);
        expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain('due_to');
    });

    it('accepts either bound sent alone', () => {
        expect(accepts(UserTaskInstanceFiltersSchema.safeParse({ due_from: '2026-08-01' }))).toBe(true);
        expect(accepts(UserTaskInstanceFiltersSchema.safeParse({ due_to: '2026-08-01' }))).toBe(true);
    });

    it('accepts no filters at all', () => {
        expect(accepts(UserTaskInstanceFiltersSchema.safeParse({}))).toBe(true);
    });
});
