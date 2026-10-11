import { Badge } from "@/components/ui/badge";
import type { TaskStatus } from "@/types/task-instance";

// Status is functional colour, never Market Blue (DESIGN.md): quiet for open states, red for rejected.
const STATUS_BADGES: Record<TaskStatus, { label: string; variant: "outline" | "secondary" | "destructive" }> = {
    pending: { label: "Pending", variant: "outline" },
    completed: { label: "Completed", variant: "secondary" },
    verified: { label: "Approved", variant: "secondary" },
    rejected: { label: "Declined", variant: "destructive" },
};

export function StatusBadge({ status }: { status: TaskStatus }) {
    const { label, variant } = STATUS_BADGES[status];

    return <Badge variant={variant}>{label}</Badge>;
}
