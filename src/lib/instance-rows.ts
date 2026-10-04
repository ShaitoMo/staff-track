import { machineDayOf } from "@/lib/machine-time";
import { describeRecurrence } from "@/lib/recurrence-label";
import { Role } from "@/types/role";
import { DateOnlySchema, toDateOnlyString } from "@/types/date-only";
import type { TaskInstanceListView, TaskStatus } from "@/types/task-instance";

export interface InstanceRow {
    instanceId: number;
    title: string;
    description: string | null;
    branchName: string;
    assignee: string;
    schedule: string;
    dueDate: string;
    status: TaskStatus;
    completedByName: string | null;
    completedDate: string | null;
    photoMediaId: number | null;
    reviewedByName: string | null;
    reviewedDate: string | null;
    /** Completed by someone else: the backend refuses self-review, so the button is only offered when it could work. */
    canReview: boolean;
}

/** Just the calendar day of a timestamp: wire timestamps arrive as ISO strings despite the `Date` type. */
function dateOnly(value: string | Date | null): string | null {
    if (value === null) return null;
    return (value instanceof Date ? value.toISOString() : value).slice(0, 10);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Today as 'YYYY-MM-DD' on the machines' calendar (Beirut), the same day the backend generates instances for. */
export function todayDateString(now = new Date()): string {
    return toDateOnlyString(machineDayOf(now));
}

/** The calendar day `days` before today, on the same calendar as todayDateString. */
export function daysAgoDateString(days: number, now = new Date()): string {
    return todayDateString(new Date(now.getTime() - days * MS_PER_DAY));
}

/** The date a `?date=` param asks for — only a real 'YYYY-MM-DD' is passed on to the API, anything else means today. */
export function parseDateParam(value: string | undefined, now = new Date()): string {
    return value !== undefined && DateOnlySchema.safeParse(value).success ? value : todayDateString(now);
}

/** Shared-role instances have no named assignee, so they show the role they are pooled under. */
export function buildInstanceRows(instances: TaskInstanceListView[], roles: Role[], viewerUserId: number): InstanceRow[] {
    const roleNames = new Map(roles.map((role) => [role.roleId, role.name]));

    const rows = instances.map((instance): InstanceRow => {
        const roleId = instance.task.assigned_role_id;

        return {
            instanceId: instance.instance_id,
            title: instance.task.title,
            description: instance.task.description,
            branchName: instance.task.branch_name,
            assignee: instance.assignee?.name
                ?? (roleId !== null ? (roleNames.get(roleId) ?? `Role #${roleId}`) : "Unassigned"),
            schedule: describeRecurrence(instance.task.recurrence),
            dueDate: instance.due_date,
            status: instance.status,
            completedByName: instance.completed_by_name,
            completedDate: dateOnly(instance.completed_at),
            photoMediaId: instance.latest_photo?.media_id ?? null,
            reviewedByName: instance.reviewed_by_name,
            reviewedDate: dateOnly(instance.reviewed_at),
            canReview: instance.status === "completed" && instance.completed_by !== viewerUserId,
        };
    });

    return rows.toSorted((a, b) => a.branchName.localeCompare(b.branchName) || a.title.localeCompare(b.title));
}
