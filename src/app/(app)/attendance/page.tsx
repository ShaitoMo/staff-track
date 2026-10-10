import { Suspense } from "react";
import { AttendanceSection } from "@/components/attendance/attendance-section";
import { MyAttendance } from "@/components/attendance/my-attendance";
import { AccessMessage } from "@/components/layout/access-message";
import { BranchFilter } from "@/components/layout/branch-filter";
import { WeekNav } from "@/components/layout/week-nav";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { mondayOf } from "@/lib/coverage-rows";
import { parseDateParam, todayDateString } from "@/lib/instance-rows";
import { MANAGER_ROLE, OWNER_ROLE } from "@/lib/rbac";
import { getSession } from "@/lib/session";
import { Branch } from "@/types/branch";

const loading = (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
    </div>
);

const noAccess = <AccessMessage title="Attendance" message="You don't have access to attendance." />;

export default async function AttendancePage({
    searchParams,
}: {
    searchParams: Promise<{ branch?: string; week?: string }>;
}) {
    const [{ branch, week }, session] = await Promise.all([searchParams, getSession()]);

    const weekStart = mondayOf(parseDateParam(week));

    // Staff see only their own shifts, through the self-or-manager endpoint. The week nav sits
    // outside the boundary so the range stays put while the next week loads.
    if (session && session.role !== OWNER_ROLE && session.role !== MANAGER_ROLE) {
        return (
            <div className="flex flex-col gap-6">
                <h1 className="text-xl font-semibold">My attendance</h1>
                <WeekNav basePath="/attendance" weekStart={weekStart} thisWeek={mondayOf(todayDateString())} query={{}} />
                <Suspense key={weekStart} fallback={loading}>
                    <MyAttendance userId={session.userId} weekStart={weekStart} />
                </Suspense>
            </div>
        );
    }

    let branches: Branch[];

    try {
        branches = await fetchApi<Branch[]>("/api/branches");
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return noAccess;
        }
        throw error;
    }

    const requestedBranchId = branch && /^\d+$/.test(branch) ? Number(branch) : undefined;
    const branchId = branches.some((b) => b.branchId === requestedBranchId) ? requestedBranchId : branches[0]?.branchId;
    const branchName = branches.find((b) => b.branchId === branchId)?.name;

    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-xl font-semibold">{branchName ? `Attendance for ${branchName}` : "Attendance"}</h1>
            {branchId === undefined ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>No branches</EmptyTitle>
                        <EmptyDescription>Attendance is recorded per branch, and there are no branches to show.</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <>
                    {branches.length > 1 ? (
                        <BranchFilter
                            basePath="/attendance"
                            branches={branches}
                            activeBranchId={branchId}
                            extraQuery={{ week: weekStart }}
                            showAll={false}
                        />
                    ) : null}
                    <Suspense key={`${branchId}-${weekStart}`} fallback={loading}>
                        <AttendanceSection branchId={branchId} weekStart={weekStart} />
                    </Suspense>
                </>
            )}
        </div>
    );
}
