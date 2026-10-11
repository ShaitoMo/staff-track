import { CreateTaskSchema, UpdateTaskSchema } from '@/types/task';

/** The paths carrying an issue, so a test names the field it expects to be blamed. */
function issuePaths(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
    return (result.error?.issues ?? []).map((issue) => issue.path.join('.'));
}

const accepts = (result: { success: boolean }) => result.success;

describe('UpdateTaskSchema — recurrence rules', () => {
    it('rejects a rule that does not parse, rather than storing a task that generates nothing', () => {
        const result = UpdateTaskSchema.safeParse({ is_recurring: true, recurrence: 'monthly' });

        expect(accepts(result)).toBe(false);
        expect(issuePaths(result)).toContain('recurrence');
    });

    it.each([['monthly'], ['weekly:'], ['weekly:funday'], ['every tuesday'], ['weekly:mon,']])(
        'rejects %p',
        (rule) => {
            expect(
                accepts(UpdateTaskSchema.safeParse({ is_recurring: true, recurrence: rule })),
            ).toBe(false);
        },
    );

    // 'DAILY ' among them: parseRule trims and lowercases, so casing and stray spaces are accepted
    it.each([['daily'], ['weekly:mon'], ['weekly:mon,wed,fri'], ['DAILY '], ['Weekly:Mon, Wed']])(
        'accepts %p',
        (rule) => {
            expect(
                accepts(UpdateTaskSchema.safeParse({ is_recurring: true, recurrence: rule })),
            ).toBe(true);
        },
    );

    it('rejects an empty rule before it reaches the parser', () => {
        expect(accepts(UpdateTaskSchema.safeParse({ is_recurring: true, recurrence: '' }))).toBe(
            false,
        );
    });
});

describe('UpdateTaskSchema — the is_recurring/recurrence pair', () => {
    it('rejects a recurring task with no rule', () => {
        const result = UpdateTaskSchema.safeParse({ is_recurring: true, recurrence: null });

        expect(accepts(result)).toBe(false);
        expect(issuePaths(result)).toContain('recurrence');
    });

    it('rejects a one-off carrying a rule', () => {
        const result = UpdateTaskSchema.safeParse({ is_recurring: false, recurrence: 'daily' });

        expect(accepts(result)).toBe(false);
        expect(issuePaths(result)).toContain('recurrence');
    });

    it('accepts a one-off with an explicitly null rule', () => {
        expect(
            accepts(UpdateTaskSchema.safeParse({ is_recurring: false, recurrence: null })),
        ).toBe(true);
    });

    it('rejects is_recurring on its own, which cannot describe the resulting schedule', () => {
        const result = UpdateTaskSchema.safeParse({ is_recurring: true });

        expect(accepts(result)).toBe(false);
        expect(issuePaths(result)).toContain('recurrence');
    });

    it('rejects a rule on its own, for the same reason', () => {
        const result = UpdateTaskSchema.safeParse({ recurrence: 'daily' });

        expect(accepts(result)).toBe(false);
        expect(issuePaths(result)).toContain('is_recurring');
    });

    it('rejects clearing the rule on its own', () => {
        expect(accepts(UpdateTaskSchema.safeParse({ recurrence: null }))).toBe(false);
    });
});

describe('UpdateTaskSchema — edits that leave the schedule alone', () => {
    it.each([
        ['title', { title: 'Wipe the counters' }],
        ['description', { description: null }],
        ['active', { active: false }],
        ['assignee', { assigned_to: 4 }],
    ])('accepts a %s edit that mentions neither field', (_field, body) => {
        expect(accepts(UpdateTaskSchema.safeParse(body))).toBe(true);
    });

    it('still rejects an empty body', () => {
        expect(accepts(UpdateTaskSchema.safeParse({}))).toBe(false);
    });

    it('accepts a schedule change alongside an unrelated edit', () => {
        expect(
            accepts(
                UpdateTaskSchema.safeParse({
                    title: 'Wipe the counters',
                    is_recurring: true,
                    recurrence: 'weekly:mon',
                }),
            ),
        ).toBe(true);
    });
});

describe('CreateTaskSchema — the same invariant at creation', () => {
    const base = { title: 'Check the fridge', branch_id: 1, assigned_to: 2, assigned_by: 3 };

    it('rejects a recurring task whose rule does not parse', () => {
        const result = CreateTaskSchema.safeParse({
            ...base,
            is_recurring: true,
            recurrence: 'monthly',
        });

        expect(accepts(result)).toBe(false);
        expect(issuePaths(result)).toContain('recurrence');
    });

    it('rejects a recurring task with no rule at all', () => {
        expect(accepts(CreateTaskSchema.safeParse({ ...base, is_recurring: true }))).toBe(false);
    });

    it('rejects a one-off carrying a rule', () => {
        const result = CreateTaskSchema.safeParse({
            ...base,
            is_recurring: false,
            due_date: '2026-09-01',
            recurrence: 'daily',
        });

        expect(accepts(result)).toBe(false);
        expect(issuePaths(result)).toContain('recurrence');
    });

    it('rejects a recurring task carrying a due_date, whose dates come from the rule', () => {
        const result = CreateTaskSchema.safeParse({
            ...base,
            is_recurring: true,
            recurrence: 'daily',
            due_date: '2026-09-01',
        });

        expect(accepts(result)).toBe(false);
        expect(issuePaths(result)).toContain('due_date');
    });

    it('accepts a recurring task with a parseable rule', () => {
        expect(
            accepts(CreateTaskSchema.safeParse({ ...base, is_recurring: true, recurrence: 'daily' })),
        ).toBe(true);
    });

    it('accepts a one-off with a due_date and no rule', () => {
        expect(
            accepts(CreateTaskSchema.safeParse({ ...base, due_date: '2026-09-01' })),
        ).toBe(true);
    });

    it('rejects an empty rule before it reaches the parser', () => {
        expect(
            accepts(CreateTaskSchema.safeParse({ ...base, is_recurring: true, recurrence: '' })),
        ).toBe(false);
    });
});
