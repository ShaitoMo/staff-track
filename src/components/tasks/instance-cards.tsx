import { InstanceDetailDialog } from "@/components/tasks/instance-detail-dialog";
import { PhotoLink } from "@/components/tasks/photo-link";
import { ReviewActions } from "@/components/tasks/review-actions";
import { StatusBadge } from "@/components/tasks/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import type { InstanceRow } from "@/lib/instance-rows";

/** The phone layout of InstanceTable: seven columns, including the review buttons, do not fit a narrow screen. */
export function InstanceCards({ rows }: { rows: InstanceRow[] }) {
    return (
        <div className="flex flex-col gap-3 md:hidden">
            {rows.map((row) => (
                <Card key={row.instanceId}>
                    <CardContent className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                            <InstanceDetailDialog row={row} />
                            <StatusBadge status={row.status} />
                        </div>
                        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                            <span>{row.branchName}</span>
                            <span className="font-mono">Due {row.dueDate}</span>
                        </div>
                        <div className="text-sm">
                            <span className="text-muted-foreground">Assigned to </span>
                            <span className="capitalize">{row.assignee}</span>
                        </div>
                        {row.completedByName !== null ? (
                            <div className="flex items-center justify-between gap-2 text-sm">
                                <span>
                                    <span className="text-muted-foreground">Done by </span>
                                    {row.completedByName}
                                </span>
                                {row.photoMediaId !== null ? <PhotoLink mediaId={row.photoMediaId} /> : null}
                            </div>
                        ) : null}
                        {row.canReview ? (
                            <div className="mt-1 flex justify-end">
                                <ReviewActions instanceId={row.instanceId} />
                            </div>
                        ) : row.status === "completed" ? (
                            <span className="text-xs text-muted-foreground">Needs another reviewer</span>
                        ) : null}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
