import { TaskRowActions } from "@/components/tasks/task-row-actions";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDictionary } from "@/i18n/server";
import { cn } from "@/lib/utils";

export interface TaskRow {
    taskId: number;
    title: string;
    branchName: string;
    assignee: string;
    schedule: string;
    active: boolean;
}

export async function TaskTable({ rows }: { rows: TaskRow[] }) {
    const t = await getDictionary();

    return (
        <div className="hidden rounded-lg border border-border bg-card md:block">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{t.tasks.task}</TableHead>
                        <TableHead>{t.tasks.branch}</TableHead>
                        <TableHead>{t.tasks.assignedTo}</TableHead>
                        <TableHead>{t.tasks.schedule}</TableHead>
                        <TableHead>{t.tasks.statusHeading}</TableHead>
                        <TableHead className="text-end">
                            <span className="sr-only">{t.tasks.actions}</span>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={row.taskId}>
                            <TableCell className="font-medium"><bdi>{row.title}</bdi></TableCell>
                            <TableCell className="text-muted-foreground">{row.branchName}</TableCell>
                            <TableCell className="capitalize">{row.assignee}</TableCell>
                            <TableCell>{row.schedule}</TableCell>
                            <TableCell>
                                <Badge variant="outline" className={cn(!row.active && "border-dashed text-muted-foreground")}>
                                    {row.active ? t.tasks.active : t.tasks.inactive}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-end">
                                <TaskRowActions taskId={row.taskId} title={row.title} active={row.active} />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
