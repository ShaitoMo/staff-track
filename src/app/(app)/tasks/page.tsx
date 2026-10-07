import Link from "next/link";
import { Suspense } from "react";
import { AccessMessage } from "@/components/layout/access-message";
import { InstanceFilters } from "@/components/tasks/instance-filters";
import { TaskDefinitions } from "@/components/tasks/task-definitions";
import { TaskInstances } from "@/components/tasks/task-instances";
import { buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { fetchApi } from "@/lib/api-server";
import { parseDateParam } from "@/lib/instance-rows";
import { MANAGER_ROLE, OWNER_ROLE } from "@/lib/rbac";
import { CHOSEN } from "@/lib/selection";
import { getSelectedBranchId, getSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { Branch } from "@/types/branch";

export default async function TasksPage({
    searchParams,
}: {
    searchParams: Promise<{ view?: string; branch?: string; date?: string }>;
}) {
    const [{ view, branch, date: dateParam }, session] = await Promise.all([searchParams, getSession()]);

    // staff would otherwise see the management chrome (Add task, view tabs) above the inner 403
    if (session?.role !== OWNER_ROLE && session?.role !== MANAGER_ROLE) {
        return <AccessMessage title="Tasks" message="You don't have access to view tasks." />;
    }

    // a failed read leaves every branch selected; the views below then show their own access message
    const branches = await fetchApi<Branch[]>("/api/branches").catch((): Branch[] => []);
    const branchId = await getSelectedBranchId(branch, branches);
    const showInstances = view === "instances";
    const date = parseDateParam(dateParam);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">Tasks</h1>
                <Link href="/tasks/new" className={buttonVariants({ size: "sm" })}>
                    Add task
                </Link>
            </div>
            <nav className="flex gap-2">
                <Link
                    href="/tasks"
                    aria-current={showInstances ? undefined : "page"}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), !showInstances && CHOSEN)}
                >
                    Tasks
                </Link>
                <Link
                    href="/tasks?view=instances"
                    aria-current={showInstances ? "page" : undefined}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), showInstances && CHOSEN)}
                >
                    Instances
                </Link>
            </nav>
            {showInstances ? <InstanceFilters date={date} branchId={branchId} /> : null}
            {/* Keyed so a new date/branch/view shows the fallback instead of keeping the old content on screen. */}
            <Suspense
                key={`${showInstances}-${date}-${branchId}`}
                fallback={
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Spinner /> Loading…
                    </div>
                }
            >
                {showInstances ? <TaskInstances date={date} branchId={branchId} /> : <TaskDefinitions branchId={branchId} />}
            </Suspense>
        </div>
    );
}
