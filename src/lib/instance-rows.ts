import { machineDayOf } from "@/lib/machine-time";
import { Role } from "@/types/role";
import { DateOnlySchema, toDateOnlyString } from "@/types/date-only";
import type { TaskInstanceListView, TaskStatus } from "@/types/task-instance";

export interface InstanceRow {
    instanceId: number;
    title: string;
    branchName: string;
    assignee: string;
    dueDate: string;
    status: TaskStatus;
}

/** Today as 'YYYY-MM-DD' on the machines' calendar (Beirut), the same day the backend generates instances for. */
export function todayDateString(now = new Date()): string {
    return toDateOnlyString(machineDayOf(now));
}

/** The date a `?date=` param asks for — only a real 'YYYY-MM-DD' is passed on to the API, anything else means today. */
export function parseDateParam(value: string | undefined, now = new Date()): string {
    return value !== undefined && DateOnlySchema.safeParse(value).success ? value : todayDateString(now);
}

/** Shared-role instances have no named assignee, so they show the role they are pooled under. */
export function buildInstanceRows(instances: TaskInstanceListView[], roles: Role[]): InstanceRow[] {
    const roleNames = new Map(roles.map((role) => [role.roleId, role.name]));

    const rows = instances.map((instance): InstanceRow => {
        const roleId = instance.task.assigned_role_id;

        return {
            instanceId: instance.instance_id,
            title: instance.task.title,
            branchName: instance.task.branch_name,
            assignee: instance.assignee?.name
                ?? (roleId !== null ? (roleNames.get(roleId) ?? `Role #${roleId}`) : "Unassigned"),
            dueDate: instance.due_date,
            status: instance.status,
        };
    });

    return rows.toSorted((a, b) => a.branchName.localeCompare(b.branchName) || a.title.localeCompare(b.title));
}
