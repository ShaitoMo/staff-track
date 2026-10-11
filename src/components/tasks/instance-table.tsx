import { InstanceDetailDialog } from "@/components/tasks/instance-detail-dialog";
import { PhotoLink } from "@/components/tasks/photo-link";
import { ReviewActions } from "@/components/tasks/review-actions";
import { StatusBadge } from "@/components/tasks/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InstanceRow } from "@/lib/instance-rows";

export function InstanceTable({ rows }: { rows: InstanceRow[] }) {
    return (
        <div className="hidden rounded-lg border border-border md:block">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Assigned to</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Completed by</TableHead>
                        <TableHead className="text-right">
                            <span className="sr-only">Review</span>
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
                            <TableCell className="text-right">
                                {row.canReview ? (
                                    <ReviewActions instanceId={row.instanceId} />
                                ) : row.status === "completed" ? (
                                    <span className="text-xs text-muted-foreground">Needs another reviewer</span>
                                ) : null}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
