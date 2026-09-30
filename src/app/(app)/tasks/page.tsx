import Link from "next/link";
import { Suspense } from "react";
import { InstanceFilters } from "@/components/tasks/instance-filters";
import { TaskDefinitions } from "@/components/tasks/task-definitions";
import { TaskInstances } from "@/components/tasks/task-instances";
import { buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { parseDateParam } from "@/lib/instance-rows";

export default async function TasksPage({
    searchParams,
}: {
    searchParams: Promise<{ view?: string; branch?: string; date?: string }>;
}) {
    const { view, branch, date: dateParam } = await searchParams;
    const branchId = branch && /^\d+$/.test(branch) ? Number(branch) : undefined;
    const showInstances = view === "instances";
    const date = parseDateParam(dateParam);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-medium">Tasks</h1>
                <Link href="/tasks/new" className={buttonVariants({ size: "sm" })}>
                    Add task
                </Link>
            </div>
            <nav className="flex gap-2">
                <Link href="/tasks" className={buttonVariants({ variant: showInstances ? "outline" : "secondary", size: "sm" })}>
                    Tasks
                </Link>
                <Link
                    href="/tasks?view=instances"
                    className={buttonVariants({ variant: showInstances ? "secondary" : "outline", size: "sm" })}
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
