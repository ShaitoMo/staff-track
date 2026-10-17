import type { Metadata } from "next";
import { Suspense } from "react";
import { StaffTaskList } from "@/components/tasks/staff-task-list";
import { Spinner } from "@/components/ui/spinner";
import { getSession } from "@/lib/session";

const loading = (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
    </div>
);

/** A staff member's full task list — what's left, and how the last week's work turned out. */
export const metadata: Metadata = { title: "My tasks" };

export default async function MyTasksPage() {
    const session = await getSession();

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-xl font-semibold">My tasks</h1>
            {session ? (
                <Suspense fallback={loading}>
                    <StaffTaskList userId={session.userId} />
                </Suspense>
            ) : null}
        </div>
    );
}
