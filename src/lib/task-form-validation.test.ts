import {
    assigneeOptionsForBranch,
    buildCreateTaskBody,
    isTaskFormValid,
    TaskFormInput,
    validateTaskForm,
} from '@/lib/task-form-validation';
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
