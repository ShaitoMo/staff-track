import type { TaskInstanceListView } from "@/types/task-instance";

/** Staff-facing, phone-first: one card per task, no actions yet. */
export function MyTaskList({ instances }: { instances: TaskInstanceListView[] }) {
    return (
        <ul className="flex flex-col gap-3">
            {instances.map((instance) => (
                <li key={instance.instance_id} className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
                    <span className="text-base font-medium">{instance.task.title}</span>
                    {instance.task.description && (
                        <span className="text-sm text-muted-foreground">{instance.task.description}</span>
                    )}
                    <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
                        <span>{instance.task.branch_name}</span>
                        <span className="font-mono">Due {instance.due_date}</span>
                    </div>
                </li>
            ))}
        </ul>
    );
}
