import { CreateTaskSchema, type CreateTaskBody } from "@/types/task";
import type { SafeUser } from "@/types/user";
import type { UserBranch } from "@/types/user-branch";

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

/** Sends only the chosen side of each either/or, which is what CreateTaskSchema's XOR rules expect. */
export function buildCreateTaskBody(input: TaskFormInput): CreateTaskBody {
    const recurring = input.schedule !== "one_off";
    const selectedDays = WEEKDAYS.filter((day) => input.weekdays.includes(day));
    const description = input.description.trim();

    return {
        title: input.title.trim(),
        description: description === "" ? null : description,
        branch_id: input.branchId!, // null is caught by validateTaskForm before anything is sent
        assigned_to: input.assigneeKind === "person" ? input.assignedTo : null,
        assigned_role_id: input.assigneeKind === "role" ? input.roleId : null,
        is_recurring: recurring,
        due_date: recurring ? null : input.dueDate,
        recurrence: input.schedule === "weekly" ? `weekly:${selectedDays.join(",")}` : input.schedule === "daily" ? "daily" : null,
    };
}

/** Validates against CreateTaskSchema (src/types/task.ts) so the rules live in one place; the route re-checks. */
export function validateTaskForm(input: TaskFormInput): TaskFormErrors {
    const errors: TaskFormErrors = {};
    const result = CreateTaskSchema.safeParse(buildCreateTaskBody(input));

    if (!result.success) {
        for (const issue of result.error.issues) {
            const field = PATH_TO_FIELD[String(issue.path[0])];
            if (field) {
                errors[field] = FIELD_MESSAGES[field];
            }
        }
    }

    return errors;
}

export function isTaskFormValid(errors: TaskFormErrors): boolean {
    return Object.keys(errors).length === 0;
}

/** Active users linked to the branch: a task can only be assigned to someone who works there. */
export function assigneeOptionsForBranch(branchId: number | null, users: SafeUser[], links: UserBranch[]): SafeUser[] {
    if (branchId === null) return [];

    const linked = new Set(links.filter((link) => link.branchId === branchId).map((link) => link.userId));
    return users.filter((user) => user.isActive && linked.has(user.userId));
}
