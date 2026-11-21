import { CompleteTaskForm } from "@/components/tasks/complete-task-form";
import { InstanceDetailDialog } from "@/components/tasks/instance-detail-dialog";
import { PhotoLink } from "@/components/tasks/photo-link";
import { StatusBadge } from "@/components/tasks/status-badge";
import { TaskReferenceButton } from "@/components/tasks/task-reference";
import { Badge } from "@/components/ui/badge";
import { getI18n } from "@/i18n/server";
import { formatDay } from "@/lib/coverage-rows";
import { type InstanceRow, todayDateString } from "@/lib/instance-rows";
import { cn } from "@/lib/utils";

/**
 * Staff-facing, phone-first: one card per task. A pending card carries the upload; a finished one
 * shows how it ended, so a declined task doesn't just vanish. The title opens the same full-detail
 * modal as the owner/manager Instances view. Only CompleteTaskForm, the reference and the dialog are client islands.
 * `upcoming` cards (tomorrow's) show what's coming without the upload: only today's work can be done.
 */
export async function MyTaskList({ rows, upcoming = false, twoUp = false }: { rows: InstanceRow[]; upcoming?: boolean; twoUp?: boolean }) {
    const { t, locale } = await getI18n();
    const today = todayDateString();

    return (
        // two-up in a wide enough container (the caller sets @container), so cards don't stretch across a
        // desktop; a lone card keeps the full width rather than leaving half the row empty
        <ul className={cn("flex flex-col gap-3", twoUp && rows.length > 1 && "@3xl:grid @3xl:grid-cols-2")}>
            {rows.map((row) => {
                const pending = row.status === "pending";
                // only a one-off reaches here overdue (splitMissed takes a recurring task's missed copies), and it's still doable
                const overdue = pending && row.dueDate < today;
                const taskLabel = t.tasks.taskLabel(row.title, formatDay(row.dueDate, locale));

                return (
                    <li key={row.instanceId} className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
                        <div className="flex items-start justify-between gap-2">
                            {/* a 44px minimum on touch, not TOUCH_HEIGHT's fixed h-11, so a wrapped title isn't clipped */}
                            <InstanceDetailDialog row={row} chevron titleClassName="text-base [@media(pointer:coarse)]:min-h-11" />
                            {pending ? null : <StatusBadge status={row.status} />}
                            {/* the badge is overdue's one red mark; the due line under it stays muted */}
                            {overdue ? <Badge variant="destructive">{t.tasks.overdue}</Badge> : null}
                        </div>
                        {row.description !== null ? (
                            // the full text is one tap away in the details, so a long one can't push the photo buttons down
                            <span className="line-clamp-2 max-w-prose text-sm text-muted-foreground"><bdi>{row.description}</bdi></span>
                        ) : null}
                        <div className="mt-1 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                            <span>{row.branchName}</span>
                            <span className="text-end">{t.tasks.dueOn(formatDay(row.dueDate, locale))}</span>
                        </div>
                        {pending && row.referenceName !== null ? (
                            <div className="mt-3">
                                <TaskReferenceButton instanceId={row.instanceId} name={row.referenceName} taskLabel={taskLabel} />
                            </div>
                        ) : null}
                        {pending && !upcoming ? <CompleteTaskForm instanceId={row.instanceId} taskLabel={taskLabel} /> : null}
                        {!pending && row.photoMediaId !== null ? (
                            <PhotoLink mediaId={row.photoMediaId} className="mt-1 text-sm text-primary hover:underline" />
                        ) : null}
                    </li>
                );
            })}
        </ul>
    );
}
