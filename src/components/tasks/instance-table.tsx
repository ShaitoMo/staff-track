import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InstanceRow } from "@/lib/instance-rows";
import type { TaskStatus } from "@/types/task-instance";

// Status is functional colour, never Market Blue (DESIGN.md): quiet for open states, red for rejected.
const STATUS_BADGES: Record<TaskStatus, { label: string; variant: "outline" | "secondary" | "destructive" }> = {
    pending: { label: "Pending", variant: "outline" },
    completed: { label: "Completed", variant: "secondary" },
    verified: { label: "Verified", variant: "secondary" },
    rejected: { label: "Rejected", variant: "destructive" },
};

export function InstanceTable({ rows }: { rows: InstanceRow[] }) {
    return (
        <div className="rounded-lg border border-border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Assigned to</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead>Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={row.instanceId}>
                            <TableCell className="font-medium">{row.title}</TableCell>
                            <TableCell className="text-muted-foreground">{row.branchName}</TableCell>
                            <TableCell>{row.assignee}</TableCell>
                            <TableCell className="font-mono">{row.dueDate}</TableCell>
                            <TableCell>
                                <Badge variant={STATUS_BADGES[row.status].variant}>{STATUS_BADGES[row.status].label}</Badge>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
