import { TaskRowActions } from "@/components/tasks/task-row-actions";
import type { TaskRow } from "@/components/tasks/task-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

/** The phone layout of TaskTable: the table's five columns and its actions do not fit a narrow screen. */
export function TaskCards({ rows }: { rows: TaskRow[] }) {
    return (
        <div className="flex flex-col gap-3 md:hidden">
            {rows.map((row) => (
                <Card key={row.taskId}>
                    <CardContent className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                            <div className="font-medium">{row.title}</div>
                            <Badge variant={row.active ? "secondary" : "outline"}>{row.active ? "Active" : "Inactive"}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">{row.branchName}</div>
                        <div className="text-sm">
                            <span className="text-muted-foreground">Assigned to </span>
                            <span className="capitalize">{row.assignee}</span>
                        </div>
                        <div className="text-sm">
                            <span className="text-muted-foreground">Repeats </span>
                            {row.schedule}
                        </div>
                        <div className="mt-1 flex justify-end">
                            <TaskRowActions taskId={row.taskId} title={row.title} active={row.active} />
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
