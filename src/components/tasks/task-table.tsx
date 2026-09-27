import { TaskRowActions } from "@/components/tasks/task-row-actions";
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
        <div className="hidden rounded-lg border border-border md:block">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Assigned to</TableHead>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">
                            <span className="sr-only">Actions</span>
                        </TableHead>
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
                            <TableCell className="text-right">
                                <TaskRowActions taskId={row.taskId} title={row.title} active={row.active} />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
