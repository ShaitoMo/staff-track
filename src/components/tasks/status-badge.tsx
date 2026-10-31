"use client";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/i18n/client";
import type { TaskStatus } from "@/types/task-instance";

// Status is functional colour, never Market Blue (DESIGN.md): quiet for open states, green once
// approved (so it reads apart from Completed, still waiting on review), red for declined.
const STATUS_VARIANTS: Record<TaskStatus, "outline" | "secondary" | "destructive" | "success"> = {
    pending: "outline",
    completed: "secondary",
    verified: "success",
    rejected: "destructive",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
    const t = useT();

    return <Badge variant={STATUS_VARIANTS[status]}>{t.tasks.status[status]}</Badge>;
}
