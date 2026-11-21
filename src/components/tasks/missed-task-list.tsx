import { getI18n } from "@/i18n/server";
import { formatDay } from "@/lib/coverage-rows";
import type { MissedRun } from "@/lib/staff-home";

/**
 * A recurring task's missed days, one quiet line per task: no photo buttons, since only today's copy
 * can be done, and not red, since it isn't for the staff member to act on — their manager sees it.
 */
export async function MissedTaskList({ runs, showBranch }: { runs: MissedRun[]; showBranch: boolean }) {
    const { t, locale } = await getI18n();

    return (
        <div className="flex flex-col gap-1.5">
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {runs.map((run) => (
                    <li key={run.taskId} className="flex flex-col gap-0.5 px-4 py-3">
                        <span className="text-sm font-medium"><bdi>{run.title}</bdi></span>
                        <span className="text-sm text-muted-foreground">
                            {t.tasks.missedSince(run.days, formatDay(run.oldestDueDate, locale))}
                            {showBranch ? <> · <bdi>{run.branchName}</bdi></> : null}
                        </span>
                    </li>
                ))}
            </ul>
            <p className="text-xs text-muted-foreground">{t.tasks.missedNote}</p>
        </div>
    );
}
