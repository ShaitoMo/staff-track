import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { CheckIcon, PencilIcon } from "lucide-react";
import { AccessMessage } from "@/components/layout/access-message";
import { BranchStack } from "@/components/layout/branch-stack";
import { WeekNav } from "@/components/layout/week-nav";
import { PrintButton } from "@/components/schedule/print-button";
import { ScheduleSection } from "@/components/schedule/schedule-section";
import { StaffSchedule } from "@/components/schedule/staff-schedule";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { mondayOf } from "@/lib/coverage-rows";
import { parseDateParam, todayDateString } from "@/lib/instance-rows";
import { MANAGER_ROLE, OWNER_ROLE } from "@/lib/rbac";
import { getSelectedBranchId, getSession } from "@/lib/session";
import { TOUCH_HEIGHT } from "@/lib/touch";
import { cn } from "@/lib/utils";
import { Branch } from "@/types/branch";
import { Role } from "@/types/role";

const loading = (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
    </div>
);

export const metadata: Metadata = { title: "Schedule" };

/**
 * The page's title and its two modes. Reading (the default) shows the finished week with Print;
 * Edit schedule opens the editing grid on the same branch and week, and Done editing comes back.
 */
function ScheduleHeader({ title, editing, query }: { title: string; editing: boolean; query: Record<string, string> }) {
    const href = (mode: "edit" | null) => `/schedule?${new URLSearchParams({ ...query, ...(mode && { mode }) })}`;

    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-semibold">{title}</h1>
            <div className="flex flex-wrap items-center gap-2 print:hidden">
                {editing ? (
                    <Link href={href(null)} className={cn(buttonVariants({ size: "sm" }), TOUCH_HEIGHT)}>
                        <CheckIcon data-icon="inline-start" />
                        Done editing
                    </Link>
                ) : (
                    <>
                        <PrintButton />
                        <Link href={href("edit")} className={cn(buttonVariants({ size: "sm" }), TOUCH_HEIGHT)}>
                            <PencilIcon data-icon="inline-start" />
                            Edit schedule
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
}

export default async function SchedulePage({
    searchParams,
}: {
    searchParams: Promise<{ branch?: string; week?: string; mode?: string }>;
}) {
    const [{ branch, week, mode }, session] = await Promise.all([searchParams, getSession()]);
    const requestedBranchId = branch && /^\d+$/.test(branch) ? Number(branch) : undefined;
    const weekStart = mondayOf(parseDateParam(week));
    const editing = mode === "edit";

    // Staff get the read-only view; it reads only their own branches, through the staff-open endpoint.
    if (session && session.role !== OWNER_ROLE && session.role !== MANAGER_ROLE) {
        return (
            <div className="flex flex-col gap-6">
                <h1 className="text-xl font-semibold">Schedule</h1>
                <Suspense key={`${branch}-${weekStart}`} fallback={loading}>
                    <StaffSchedule
                        userId={session.userId}
                        branchIds={session.branchIds}
                        requestedBranchId={requestedBranchId}
                        weekStart={weekStart}
                    />
                </Suspense>
            </div>
        );
    }

    let branches: Branch[];
    let roles: Role[];

    try {
        [branches, roles] = await Promise.all([
            fetchApi<Branch[]>("/api/branches"),
            fetchApi<Role[]>("/api/roles"),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title="Schedule" message="You don't have access to the schedule." />;
        }
        throw error;
    }

    const visibleRoles = session?.role === OWNER_ROLE ? roles : roles.filter((role) => role.name !== OWNER_ROLE);

    const branchId = await getSelectedBranchId(branch, branches);
    const branchName = branches.find((b) => b.branchId === branchId)?.name;

    if (branches.length === 0) {
        return (
            <div className="flex flex-col gap-6">
                <h1 className="text-xl font-semibold">Schedule</h1>
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>No branches</EmptyTitle>
                        <EmptyDescription>The schedule is set per branch, and there are no branches to show.</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </div>
        );
    }

    // switching mode keeps the branch and week in view
    const viewQuery = { ...(branchId !== undefined && { branch: String(branchId) }), week: weekStart };

    // "All branches" in the top bar: one week nav, then every branch's schedule
    if (branchId === undefined) {
        return (
            <div data-print-target className="flex flex-col gap-6">
                <ScheduleHeader title="Schedule" editing={editing} query={viewQuery} />
                <div className="print:hidden">
                    <WeekNav
                        basePath="/schedule"
                        weekStart={weekStart}
                        thisWeek={mondayOf(todayDateString())}
                        query={editing ? { mode: "edit" } : {}}
                    />
                </div>
                <BranchStack branches={branches} basePath="/schedule" query={{ week: weekStart, ...(editing && { mode: "edit" }) }}>
                    {(b) => (
                        <Suspense key={`${b.branchId}-${weekStart}`} fallback={loading}>
                            <ScheduleSection
                                branchId={b.branchId}
                                weekStart={weekStart}
                                roles={visibleRoles}
                                editing={editing}
                                showWeekNav={false}
                            />
                        </Suspense>
                    )}
                </BranchStack>
            </div>
        );
    }

    return (
        <div data-print-target className="flex flex-col gap-6">
            <ScheduleHeader title={`Schedule for ${branchName}`} editing={editing} query={viewQuery} />
            <Suspense key={`${branchId}-${weekStart}`} fallback={loading}>
                <ScheduleSection branchId={branchId} weekStart={weekStart} roles={visibleRoles} editing={editing} />
            </Suspense>
        </div>
    );
}
