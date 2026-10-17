import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessMessage } from "@/components/layout/access-message";
import { BranchStack } from "@/components/layout/branch-stack";
import { WeekNav } from "@/components/layout/week-nav";
import { ScheduleSection } from "@/components/schedule/schedule-section";
import { StaffSchedule } from "@/components/schedule/staff-schedule";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { mondayOf } from "@/lib/coverage-rows";
import { parseDateParam, todayDateString } from "@/lib/instance-rows";
import { MANAGER_ROLE, OWNER_ROLE } from "@/lib/rbac";
import { getSelectedBranchId, getSession } from "@/lib/session";
import { Branch } from "@/types/branch";
import { Role } from "@/types/role";

const loading = (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
    </div>
);

export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage({
    searchParams,
}: {
    searchParams: Promise<{ branch?: string; week?: string }>;
}) {
    const [{ branch, week }, session] = await Promise.all([searchParams, getSession()]);
    const requestedBranchId = branch && /^\d+$/.test(branch) ? Number(branch) : undefined;
    const weekStart = mondayOf(parseDateParam(week));

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

    // "All branches" in the top bar: one week nav, then every branch's schedule
    if (branchId === undefined) {
        return (
            <div className="flex flex-col gap-6">
                <h1 className="text-xl font-semibold">Schedule</h1>
                <WeekNav basePath="/schedule" weekStart={weekStart} thisWeek={mondayOf(todayDateString())} query={{}} />
                <BranchStack branches={branches} basePath="/schedule" query={{ week: weekStart }}>
                    {(b) => (
                        <Suspense key={`${b.branchId}-${weekStart}`} fallback={loading}>
                            <ScheduleSection branchId={b.branchId} weekStart={weekStart} roles={visibleRoles} showWeekNav={false} />
                        </Suspense>
                    )}
                </BranchStack>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-xl font-semibold">{`Schedule for ${branchName}`}</h1>
            <Suspense key={`${branchId}-${weekStart}`} fallback={loading}>
                <ScheduleSection branchId={branchId} weekStart={weekStart} roles={visibleRoles} />
            </Suspense>
        </div>
    );
}
