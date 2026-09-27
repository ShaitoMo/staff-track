import { CreateTaskSchema, UpdateTaskSchema, type CreateTaskBody, type TaskWire, type UpdateTaskInput } from "@/types/task";
import type { SafeUser } from "@/types/user";
import type { UserBranch } from "@/types/user-branch";

/** The only user fields the form needs: the pages send these to the client, not whole user records (no phone numbers). */
export type AssigneeCandidate = Pick<SafeUser, "userId" | "name" | "isActive">;
export type BranchLink = Pick<UserBranch, "userId" | "branchId">;

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export type AssigneeKind = "person" | "role";
export type Schedule = "one_off" | "daily" | "weekly";

export interface TaskFormInput {
    title: string;
    description: string;
    branchId: number | null;
    assigneeKind: AssigneeKind;
    assignedTo: number | null;
    roleId: number | null;
    schedule: Schedule;
    dueDate: string;
    weekdays: Weekday[];
}

export interface TaskFormErrors {
    title?: string;
    branchId?: string;
    assignee?: string;
    dueDate?: string;
    weekdays?: string;
}

const FIELD_MESSAGES = {
    title: "Title is required and can be at most 255 characters.",
    branchId: "Branch is required.",
    assignee: "Choose who this task is assigned to.",
    dueDate: "Choose a valid due date.",
    weekdays: "Choose at least one weekday.",
} as const;

/** Maps the schema's snake_case issue paths onto the form's fields. */
const PATH_TO_FIELD: Record<string, keyof TaskFormErrors> = {
    title: "title",
    branch_id: "branchId",
    assigned_to: "assignee",
    assigned_role_id: "assignee",
    due_date: "dueDate",
    recurrence: "weekdays",
};

/** The kind of assignee is picked but nobody (or no role) is chosen under it. */
function assigneeUnchosen(input: TaskFormInput): boolean {
    return input.assigneeKind === "person" ? input.assignedTo === null : input.roleId === null;
}

/** Turns a schema's issues into per-field messages; shared by the create and edit validators. */
function issuesToErrors(issues: readonly { path: readonly PropertyKey[] }[], errors: TaskFormErrors = {}): TaskFormErrors {
    for (const issue of issues) {
        const field = PATH_TO_FIELD[String(issue.path[0])];
        if (field) {
            errors[field] = FIELD_MESSAGES[field];
        }
    }

    return errors;
}

/** The stored rule for a schedule: 'daily', 'weekly:mon,wed' (always in calendar order), or null for a one-off. */
export function formatRecurrence(schedule: Schedule, weekdays: Weekday[]): string | null {
    if (schedule === "daily") return "daily";
    if (schedule === "weekly") return `weekly:${WEEKDAYS.filter((day) => weekdays.includes(day)).join(",")}`;
    return null;
}

/** The inverse of formatRecurrence, for filling the edit form from a stored task. */
export function parseRecurrence(recurrence: string | null): { schedule: Schedule; weekdays: Weekday[] } {
    if (recurrence === "daily") return { schedule: "daily", weekdays: [] };

    const [kind, days] = (recurrence ?? "").split(":");
    if (kind === "weekly" && days) {
        return { schedule: "weekly", weekdays: WEEKDAYS.filter((day) => days.split(",").includes(day)) };
    }

    // a one-off, or a rule the schema would never have let in (isValidRecurrence gates every write)
    return { schedule: "one_off", weekdays: [] };
}

/** Sends only the chosen side of each either/or, which is what CreateTaskSchema's XOR rules expect. */
export function buildCreateTaskBody(input: TaskFormInput): CreateTaskBody {
    const recurring = input.schedule !== "one_off";
    const description = input.description.trim();

    return {
        title: input.title.trim(),
        description: description === "" ? null : description,
        branch_id: input.branchId!, // null is caught by validateTaskForm before anything is sent
        assigned_to: input.assigneeKind === "person" ? input.assignedTo : null,
        assigned_role_id: input.assigneeKind === "role" ? input.roleId : null,
        is_recurring: recurring,
        due_date: recurring ? null : input.dueDate,
        recurrence: formatRecurrence(input.schedule, input.weekdays),
    };
}

/** Validates against CreateTaskSchema (src/types/task.ts) so the rules live in one place; the route re-checks. */
export function validateTaskForm(input: TaskFormInput): TaskFormErrors {
    const result = CreateTaskSchema.safeParse(buildCreateTaskBody(input));
    const errors = result.success ? {} : issuesToErrors(result.error.issues);

    // the schema's either/or check on the assignee is skipped while other fields are invalid,
    // which would show this error only after a second submit
    if (assigneeUnchosen(input)) {
        errors.assignee = FIELD_MESSAGES.assignee;
    }

    return errors;
}

export function isTaskFormValid(errors: TaskFormErrors): boolean {
    return Object.keys(errors).length === 0;
}

/** Active users linked to the branch: a task can only be assigned to someone who works there. */
export function assigneeOptionsForBranch(branchId: number | null, users: AssigneeCandidate[], links: BranchLink[]): AssigneeCandidate[] {
    if (branchId === null) return [];

    const linked = new Set(links.filter((link) => link.branchId === branchId).map((link) => link.userId));
    return users.filter((user) => user.isActive && linked.has(user.userId));
}

/** What the edit form edits: the create form's fields plus the task's active flag. */
export interface EditableTaskState extends TaskFormInput {
    active: boolean;
}

/** The edit form's starting point. A stored task carries no due date (that lives on its instance), so it stays blank and is never sent. */
export function taskToEditableState(task: TaskWire): EditableTaskState {
    return {
        title: task.title,
        description: task.description ?? "",
        branchId: task.branch_id,
        assigneeKind: task.assigned_to !== null ? "person" : "role",
        assignedTo: task.assigned_to,
        roleId: task.assigned_role_id,
        ...parseRecurrence(task.recurrence),
        dueDate: "",
        active: task.active,
    };
}

/**
 * The PATCH body for an edit: only what changed. Two rules from UpdateTaskSchema and the service
 * shape it. The assignee pair is sent together (one side null) because the merged result must
 * still name exactly one. The schedule pair is sent together, and only for a recurring task whose
 * rule changed, because a one-off cannot become recurring (nor back) and has no rule to change.
 * Branch and due date are never sent: neither is editable.
 */
export function buildUpdateTaskBody(initial: EditableTaskState, current: EditableTaskState): UpdateTaskInput {
    const body: UpdateTaskInput = {};

    const title = current.title.trim();
    if (title !== initial.title.trim()) {
        body.title = title;
    }

    const description = current.description.trim() || null;
    if (description !== (initial.description.trim() || null)) {
        body.description = description;
    }

    const assigneeChanged = current.assigneeKind !== initial.assigneeKind
        || (current.assigneeKind === "person" ? current.assignedTo !== initial.assignedTo : current.roleId !== initial.roleId);
    if (assigneeChanged) {
        body.assigned_to = current.assigneeKind === "person" ? current.assignedTo : null;
        body.assigned_role_id = current.assigneeKind === "role" ? current.roleId : null;
    }

    if (initial.schedule !== "one_off") {
        const recurrence = formatRecurrence(current.schedule, current.weekdays);
        if (recurrence !== formatRecurrence(initial.schedule, initial.weekdays)) {
            body.is_recurring = true;
            body.recurrence = recurrence;
        }
    }

    if (current.active !== initial.active) {
        body.active = current.active;
    }

    return body;
}

export function hasTaskChanges(body: UpdateTaskInput): boolean {
    return Object.keys(body).length > 0;
}

/** Validates an edit's patch against UpdateTaskSchema. An empty patch is not an error here: the form just has nothing to send. */
export function validateTaskUpdate(initial: EditableTaskState, current: EditableTaskState): TaskFormErrors {
    const errors: TaskFormErrors = {};
    const body = buildUpdateTaskBody(initial, current);

    // the schema only checks a sent assignee pair is well formed; a person or role left unchosen
    // shows up as a null id on the side that was picked
    if (assigneeUnchosen(current)) {
        errors.assignee = FIELD_MESSAGES.assignee;
    }

    if (!hasTaskChanges(body)) {
        return errors;
    }

    const result = UpdateTaskSchema.safeParse(body);

    return result.success ? errors : issuesToErrors(result.error.issues, errors);
}
