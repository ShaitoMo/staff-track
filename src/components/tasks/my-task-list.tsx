import { CompleteTaskForm } from "@/components/tasks/complete-task-form";
import { InstanceDetailDialog } from "@/components/tasks/instance-detail-dialog";
import { PhotoLink } from "@/components/tasks/photo-link";
import { StatusBadge } from "@/components/tasks/status-badge";
import type { InstanceRow } from "@/lib/instance-rows";

/**
 * Staff-facing, phone-first: one card per task. A pending card carries the upload; a finished one
 * shows how it ended, so a declined task doesn't just vanish. The title opens the same full-detail
 * modal as the owner/manager Instances view. Only CompleteTaskForm and the dialog are client islands.
 */
export function MyTaskList({ rows }: { rows: InstanceRow[] }) {
    return (
        <ul className="flex flex-col gap-3">
            {rows.map((row) => {
                const pending = row.status === "pending";

                return (
                    <li key={row.instanceId} className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
                        <div className="flex items-start justify-between gap-2">
                            <InstanceDetailDialog row={row} titleClassName="text-base" />
                            {pending ? null : <StatusBadge status={row.status} />}
                        </div>
                        {row.description !== null ? (
                            <span className="text-sm text-muted-foreground">{row.description}</span>
                        ) : null}
                        <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
                            <span>{row.branchName}</span>
                            <span className="font-mono">Due {row.dueDate}</span>
                        </div>
                        {pending ? <CompleteTaskForm instanceId={row.instanceId} /> : null}
                        {!pending && row.photoMediaId !== null ? (
                            <PhotoLink mediaId={row.photoMediaId} className="mt-1 text-sm text-primary hover:underline" />
                        ) : null}
                    </li>
                );
            })}
        </ul>
    );
}
