import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface TaskRow {
    taskId: number;
    title: string;
    branchName: string;
    assignee: string;
    schedule: string;
    active: boolean;
}

export function TaskTable({ rows }: { rows: TaskRow[] }) {
    return (
        <div className="rounded-lg border border-border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Assigned to</TableHead>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={row.taskId}>
                            <TableCell className="font-medium">{row.title}</TableCell>
                            <TableCell className="text-muted-foreground">{row.branchName}</TableCell>
                            <TableCell>{row.assignee}</TableCell>
                            <TableCell>{row.schedule}</TableCell>
                            <TableCell>
                                <Badge variant={row.active ? "secondary" : "outline"}>{row.active ? "Active" : "Inactive"}</Badge>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
