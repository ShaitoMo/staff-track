import {
    assigneeOptionsForBranch,
    buildCreateTaskBody,
    buildUpdateTaskBody,
    EditableTaskState,
    formatRecurrence,
    isTaskFormValid,
    parseRecurrence,
    taskToEditableState,
    TaskFormInput,
    validateTaskForm,
    validateTaskUpdate,
} from '@/lib/task-form-validation';
import type { TaskWire } from '@/types/task';
import type { SafeUser } from '@/types/user';

const validOneOff: TaskFormInput = {
    title: 'Restock fridge',
    description: '',
    branchId: 1,
    assigneeKind: 'person',
    assignedTo: 5,
    roleId: null,
    schedule: 'one_off',
    dueDate: '2026-10-01',
    weekdays: [],
};

describe('validateTaskForm', () => {
    it('accepts a one-off task for a person', () => {
        expect(isTaskFormValid(validateTaskForm(validOneOff))).toBe(true);
    });

    it('accepts a one-off task for a role', () => {
        const input = { ...validOneOff, assigneeKind: 'role' as const, assignedTo: null, roleId: 3 };
        expect(isTaskFormValid(validateTaskForm(input))).toBe(true);
    });

    it('accepts a daily task', () => {
        const input = { ...validOneOff, schedule: 'daily' as const, dueDate: '' };
        expect(isTaskFormValid(validateTaskForm(input))).toBe(true);
    });

    it('accepts a weekly task with days chosen', () => {
        const input = { ...validOneOff, schedule: 'weekly' as const, dueDate: '', weekdays: ['mon' as const, 'wed' as const] };
        expect(isTaskFormValid(validateTaskForm(input))).toBe(true);
    });

    it('rejects a whitespace-only title', () => {
        expect(validateTaskForm({ ...validOneOff, title: '   ' }).title).toBeDefined();
    });

    it('rejects a title longer than 255 characters', () => {
        expect(validateTaskForm({ ...validOneOff, title: 'a'.repeat(256) }).title).toBeDefined();
    });

    it('requires a branch', () => {
        expect(validateTaskForm({ ...validOneOff, branchId: null }).branchId).toBeDefined();
    });

    it('requires a person when assigning to a person', () => {
        expect(validateTaskForm({ ...validOneOff, assignedTo: null }).assignee).toBeDefined();
    });

    it('requires a role when assigning to a role', () => {
        const input = { ...validOneOff, assigneeKind: 'role' as const, assignedTo: null, roleId: null };
        expect(validateTaskForm(input).assignee).toBeDefined();
    });

    it('ignores a leftover person when the role side is chosen', () => {
        const input = { ...validOneOff, assigneeKind: 'role' as const, assignedTo: 5, roleId: 3 };
        expect(isTaskFormValid(validateTaskForm(input))).toBe(true);
    });

    it('requires a due date for a one-off task', () => {
        expect(validateTaskForm({ ...validOneOff, dueDate: '' }).dueDate).toBeDefined();
    });

    it('rejects an impossible due date', () => {
        expect(validateTaskForm({ ...validOneOff, dueDate: '2026-02-31' }).dueDate).toBeDefined();
    });

    it('requires at least one weekday for a weekly task', () => {
        const input = { ...validOneOff, schedule: 'weekly' as const, dueDate: '', weekdays: [] };
        expect(validateTaskForm(input).weekdays).toBeDefined();
    });
});

describe('buildCreateTaskBody', () => {
    it('sends only the chosen assignee and the due date for a one-off', () => {
        expect(buildCreateTaskBody(validOneOff)).toEqual({
            title: 'Restock fridge',
            description: null,
            branch_id: 1,
            assigned_to: 5,
            assigned_role_id: null,
            is_recurring: false,
            due_date: '2026-10-01',
            recurrence: null,
        });
    });

    it('sends the rule and no due date for a recurring task', () => {
        const body = buildCreateTaskBody({ ...validOneOff, schedule: 'daily' });
        expect(body).toMatchObject({ is_recurring: true, due_date: null, recurrence: 'daily' });
    });

    it('writes weekdays in calendar order whatever order they were clicked', () => {
        const body = buildCreateTaskBody({ ...validOneOff, schedule: 'weekly', weekdays: ['wed', 'mon'] });
        expect(body.recurrence).toBe('weekly:mon,wed');
    });

    it('trims the description and sends null when it is blank', () => {
        expect(buildCreateTaskBody({ ...validOneOff, description: '  Check dates  ' }).description).toBe('Check dates');
        expect(buildCreateTaskBody({ ...validOneOff, description: '   ' }).description).toBeNull();
    });
});

describe('assigneeOptionsForBranch', () => {
    const user = (userId: number, isActive = true) => ({ userId, name: `User ${userId}`, isActive }) as SafeUser;
    const users = [user(1), user(2), user(3, false), user(4)];
    const links = [
        { userId: 1, branchId: 10 },
        { userId: 2, branchId: 20 },
        { userId: 3, branchId: 10 },
    ];

    it('returns the active users linked to the branch', () => {
        expect(assigneeOptionsForBranch(10, users, links).map((u) => u.userId)).toEqual([1]);
    });

    it('returns nothing before a branch is chosen', () => {
        expect(assigneeOptionsForBranch(null, users, links)).toEqual([]);
    });
});

describe('formatRecurrence and parseRecurrence', () => {
    it.each([
        [null, 'one_off', []],
        ['daily', 'daily', []],
        ['weekly:mon,wed', 'weekly', ['mon', 'wed']],
    ] as const)('round-trips %p', (rule, schedule, weekdays) => {
        expect(parseRecurrence(rule)).toEqual({ schedule, weekdays });
        expect(formatRecurrence(schedule, [...weekdays])).toBe(rule);
    });

    it('writes weekdays in calendar order however they were chosen', () => {
        expect(formatRecurrence('weekly', ['wed', 'mon'])).toBe('weekly:mon,wed');
    });

    it('reads an unknown rule as a one-off rather than guessing', () => {
        expect(parseRecurrence('monthly')).toEqual({ schedule: 'one_off', weekdays: [] });
    });
});

describe('editing a task', () => {
    const task: TaskWire = {
        task_id: 9, title: 'Restock', description: null, branch_id: 1, assigned_to: 5, assigned_role_id: null,
        assigned_by: 1, origin: 'assigned', is_recurring: true, recurrence: 'weekly:mon,wed', active: true,
        created_at: '2026-10-01T00:00:00.000Z',
    };
    const initial = taskToEditableState(task);
    const edited = (changes: Partial<EditableTaskState>): EditableTaskState => ({ ...initial, ...changes });

    it('fills the form from the stored task', () => {
        expect(initial).toMatchObject({
            title: 'Restock', description: '', branchId: 1, assigneeKind: 'person', assignedTo: 5,
            schedule: 'weekly', weekdays: ['mon', 'wed'], active: true,
        });
    });

    it('sends nothing when nothing changed', () => {
        expect(buildUpdateTaskBody(initial, edited({}))).toEqual({});
    });

    it('sends only the title when only the title changed', () => {
        expect(buildUpdateTaskBody(initial, edited({ title: ' New name ' }))).toEqual({ title: 'New name' });
    });

    it('clears a description by sending null', () => {
        const withText = { ...initial, description: 'old' };
        expect(buildUpdateTaskBody(withText, { ...withText, description: '  ' })).toEqual({ description: null });
    });

    it('sends both assignee fields, one null, when the person changes', () => {
        expect(buildUpdateTaskBody(initial, edited({ assignedTo: 6 }))).toEqual({ assigned_to: 6, assigned_role_id: null });
    });

    it('switches from a person to a role by nulling the person', () => {
        expect(buildUpdateTaskBody(initial, edited({ assigneeKind: 'role', roleId: 3 }))).toEqual({
            assigned_to: null,
            assigned_role_id: 3,
        });
    });

    it('sends the schedule pair together when the rule changes', () => {
        expect(buildUpdateTaskBody(initial, edited({ weekdays: ['mon', 'fri'] }))).toEqual({
            is_recurring: true,
            recurrence: 'weekly:mon,fri',
        });
    });

    it('sends no schedule when the same days were picked in a different order', () => {
        expect(buildUpdateTaskBody(initial, edited({ weekdays: ['wed', 'mon'] }))).toEqual({});
    });

    it('never sends a schedule for a one-off, whatever the form holds', () => {
        const oneOff = taskToEditableState({ ...task, is_recurring: false, recurrence: null });
        expect(buildUpdateTaskBody(oneOff, { ...oneOff, schedule: 'daily' })).toEqual({});
    });

    it('sends the active flag when it flips', () => {
        expect(buildUpdateTaskBody(initial, edited({ active: false }))).toEqual({ active: false });
    });

    it('is valid with no changes', () => {
        expect(isTaskFormValid(validateTaskUpdate(initial, edited({})))).toBe(true);
    });

    it('rejects an emptied title', () => {
        expect(validateTaskUpdate(initial, edited({ title: '  ' })).title).toBeDefined();
    });

    it('rejects a weekly rule with no days', () => {
        expect(validateTaskUpdate(initial, edited({ weekdays: [] })).weekdays).toBeDefined();
    });

    it('rejects a person left unchosen', () => {
        expect(validateTaskUpdate(initial, edited({ assignedTo: null })).assignee).toBeDefined();
    });

    it('rejects a role left unchosen after switching to role', () => {
        expect(validateTaskUpdate(initial, edited({ assigneeKind: 'role', roleId: null })).assignee).toBeDefined();
    });
});

describe('validateTaskForm — assignee error alongside other errors', () => {
    it('reports an unchosen person on the same submit as a missing title and branch', () => {
        const errors = validateTaskForm({ ...validOneOff, title: '', branchId: null, assignedTo: null });

        expect(errors.title).toBeDefined();
        expect(errors.branchId).toBeDefined();
        expect(errors.assignee).toBeDefined();
    });

    it('reports an unchosen role too', () => {
        const errors = validateTaskForm({ ...validOneOff, title: '', assigneeKind: 'role', roleId: null });

        expect(errors.assignee).toBeDefined();
    });
});
