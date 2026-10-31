import type { Metadata } from "next";
import { Suspense } from "react";
import { StaffTaskList } from "@/components/tasks/staff-task-list";
import { Spinner } from "@/components/ui/spinner";
import { getDictionary } from "@/i18n/server";
import { getSession } from "@/lib/session";

/** A staff member's full task list — what's left, and how the last week's work turned out. */
export async function generateMetadata(): Promise<Metadata> {
    return { title: (await getDictionary()).tasks.myTitle };
}

export default async function MyTasksPage() {
    const [session, t] = await Promise.all([getSession(), getDictionary()]);

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-xl font-semibold">{t.tasks.myTitle}</h1>
            {session ? (
                <Suspense
                    fallback={
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Spinner /> {t.tasks.loading}
                        </div>
                    }
                >
                    <StaffTaskList userId={session.userId} />
                </Suspense>
            ) : null}
        </div>
    );
}
