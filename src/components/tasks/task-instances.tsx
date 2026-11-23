import Link from "next/link";
import { AccessMessage } from "@/components/layout/access-message";
import { InstanceCards } from "@/components/tasks/instance-cards";
import { InstanceTable } from "@/components/tasks/instance-table";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ApiError } from "@/lib/api-client";
import { getDictionary, getI18n } from "@/i18n/server";
import { fetchApi } from "@/lib/api-server";
import { formatDay } from "@/lib/coverage-rows";
import { buildInstanceRows, todayDateString } from "@/lib/instance-rows";
import { getSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { Role } from "@/types/role";
import type { TaskWire } from "@/types/task";
import type { TaskInstanceListView } from "@/types/task-instance";

/** Everything scoped to one day: streams in behind the page's Suspense boundary. */
export async function TaskInstances({ date, branchId }: { date: string; branchId?: number }) {
    const query = new URLSearchParams({ date });
    if (branchId !== undefined) {
        query.set("branch_id", String(branchId));
    }

    const t = await getDictionary();
    let instances: TaskInstanceListView[];
    let roles: Role[];
    let session: Awaited<ReturnType<typeof getSession>>;

    try {
        [instances, roles, session] = await Promise.all([
            fetchApi<TaskInstanceListView[]>(`/api/task-instances?${query}`),
            fetchApi<Role[]>("/api/roles"),
            getSession(),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title={t.tasks.title} message={t.tasks.noInstanceAccess} />;
        }
        throw error;
    }

    // the (app) layout already turned away anyone without a session; refuse rather than offer review to no one in particular
    if (!session) {
        throw new Error("Instances view rendered without a session");
    }

    const rows = buildInstanceRows(instances, roles, session.userId, t.tasks);

    if (rows.length === 0) {
        return <NoInstances date={date} branchId={branchId} />;
    }

    return (
        <div className="flex flex-col gap-4">
            <InstanceTable rows={rows} />
            <InstanceCards rows={rows} />
        </div>
    );
}

/** An empty day means one of two things: the branch has no tasks at all, or none of its tasks fall on this date. */
async function NoInstances({ date, branchId }: { date: string; branchId?: number }) {
    const [{ t, locale }, tasks] = await Promise.all([getI18n(), fetchApi<TaskWire[]>("/api/tasks")]);
    const hasTasks = tasks.some((task) => branchId === undefined || task.branch_id === branchId);

    if (!hasTasks) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>{t.tasks.noTasksFound}</EmptyTitle>
                    <EmptyDescription>{branchId !== undefined ? t.tasks.branchHasNoTasks : t.tasks.noTasksYet}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    {/* outline: the page header already carries the one blue Add task */}
                    <Link href="/tasks/new" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                        {t.tasks.addTask}
                    </Link>
                </EmptyContent>
            </Empty>
        );
    }

    const todayQuery = new URLSearchParams({ view: "instances" });
    if (branchId !== undefined) {
        todayQuery.set("branch", String(branchId));
    }

    return (
        <Empty>
            <EmptyHeader>
                <EmptyTitle>{t.tasks.noTasksDue}</EmptyTitle>
                <EmptyDescription>{t.tasks.nothingDueOn(formatDay(date, locale))}</EmptyDescription>
            </EmptyHeader>
            {date !== todayDateString() ? (
                <EmptyContent>
                    <Link href={`/tasks?${todayQuery}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                        {t.layout.backToToday}
                    </Link>
                </EmptyContent>
            ) : null}
        </Empty>
    );
}
