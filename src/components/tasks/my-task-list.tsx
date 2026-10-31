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
 */
export async function MyTaskList({ rows, className }: { rows: InstanceRow[]; className?: string }) {
    const { t, locale } = await getI18n();
    const today = todayDateString();

    return (
        <ul className={cn("flex flex-col gap-3", className)}>
            {rows.map((row) => {
                const pending = row.status === "pending";
                // a recurring task repeats its title daily, so an overdue copy must say so or it reads as a duplicate
                const overdue = pending && row.dueDate < today;
                const taskLabel = t.tasks.taskLabel(row.title, formatDay(row.dueDate, locale));

                return (
                    <li key={row.instanceId} className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
                        <div className="flex items-start justify-between gap-2">
                            {/* a 44px minimum on touch, not TOUCH_HEIGHT's fixed h-11, so a wrapped title isn't clipped */}
                            <InstanceDetailDialog row={row} titleClassName="text-base [@media(pointer:coarse)]:min-h-11" />
                            {pending ? null : <StatusBadge status={row.status} />}
                            {overdue ? <Badge variant="destructive">{t.tasks.overdue}</Badge> : null}
                        </div>
                        {row.description !== null ? (
                            <span className="max-w-prose text-sm text-muted-foreground"><bdi>{row.description}</bdi></span>
                        ) : null}
                        <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
                            <span>{row.branchName}</span>
                            <span className={cn(overdue && "text-destructive")}>{t.tasks.dueOn(formatDay(row.dueDate, locale))}</span>
                        </div>
                        {pending && row.referenceName !== null ? (
                            <div className="mt-3">
                                <TaskReferenceButton instanceId={row.instanceId} name={row.referenceName} taskLabel={taskLabel} />
                            </div>
                        ) : null}
                        {pending ? <CompleteTaskForm instanceId={row.instanceId} taskLabel={taskLabel} /> : null}
                        {!pending && row.photoMediaId !== null ? (
                            <PhotoLink mediaId={row.photoMediaId} className="mt-1 text-sm text-primary hover:underline" />
                        ) : null}
                    </li>
                );
            })}
        </ul>
    );
}
