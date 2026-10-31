import { InstanceDetailDialog } from "@/components/tasks/instance-detail-dialog";
import { PhotoLink } from "@/components/tasks/photo-link";
import { ReviewActions } from "@/components/tasks/review-actions";
import { StatusBadge } from "@/components/tasks/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDictionary } from "@/i18n/server";
import type { InstanceRow } from "@/lib/instance-rows";

export async function InstanceTable({ rows }: { rows: InstanceRow[] }) {
    const t = await getDictionary();

    return (
        <div className="hidden rounded-lg border border-border bg-card md:block">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{t.tasks.task}</TableHead>
                        <TableHead>{t.tasks.branch}</TableHead>
                        <TableHead>{t.tasks.assignedTo}</TableHead>
                        <TableHead>{t.tasks.due}</TableHead>
                        <TableHead>{t.tasks.statusHeading}</TableHead>
                        <TableHead>{t.tasks.completedBy}</TableHead>
                        <TableHead className="text-end">
                            <span className="sr-only">{t.tasks.review}</span>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={row.instanceId}>
                            <TableCell className="font-medium">
                                <InstanceDetailDialog row={row} />
                            </TableCell>
                            <TableCell className="text-muted-foreground">{row.branchName}</TableCell>
                            <TableCell className="capitalize">{row.assignee}</TableCell>
                            <TableCell className="font-mono">{row.dueDate}</TableCell>
                            <TableCell>
                                <StatusBadge status={row.status} />
                            </TableCell>
                            <TableCell>
                                {row.completedByName !== null ? (
                                    <div className="flex flex-col">
                                        <span>{row.completedByName}</span>
                                        {row.photoMediaId !== null ? <PhotoLink mediaId={row.photoMediaId} /> : null}
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground">-</span>
                                )}
                            </TableCell>
                            <TableCell className="text-end">
                                {row.canReview ? (
                                    <ReviewActions instanceId={row.instanceId} />
                                ) : row.status === "completed" ? (
                                    <span className="text-xs text-muted-foreground">{t.tasks.needsAnotherReviewer}</span>
                                ) : null}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
