import type { Metadata } from "next";
import { Suspense } from "react";
import { AttendanceSection } from "@/components/attendance/attendance-section";
import { MyAttendance } from "@/components/attendance/my-attendance";
import { AttendanceRange, RangeSwitch } from "@/components/attendance/range-switch";
import { AccessMessage } from "@/components/layout/access-message";
import { BranchStack } from "@/components/layout/branch-stack";
import { DayNav } from "@/components/layout/day-nav";
import { WeekNav } from "@/components/layout/week-nav";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { addDays, mondayOf } from "@/lib/coverage-rows";
import { parseDateParam, todayDateString } from "@/lib/instance-rows";
import { MANAGER_ROLE, OWNER_ROLE } from "@/lib/rbac";
import { getSelectedBranchId, getSession } from "@/lib/session";
import { Branch } from "@/types/branch";

const loading = (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
    </div>
);

const noAccess = <AccessMessage title="Attendance" message="You don't have access to attendance." />;

export const metadata: Metadata = { title: "Attendance" };

/** Day | Week, then the nav for that range. Both sit outside the Suspense boundary, so they stay put while the next range loads. */
function RangeBar({ view, from, query }: { view: AttendanceRange; from: string; query: Record<string, string> }) {
    const today = todayDateString();

    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <RangeSwitch view={view} from={from} today={today} query={query} />
            {view === "day" ? (
                <DayNav basePath="/attendance" date={from} today={today} query={query} />
            ) : (
                <WeekNav basePath="/attendance" weekStart={from} thisWeek={mondayOf(today)} query={query} />
            )}
        </div>
    );
}

export default async function AttendancePage({
    searchParams,
}: {
    searchParams: Promise<{ branch?: string; week?: string; date?: string }>;
}) {
    const [{ branch, week, date }, session] = await Promise.all([searchParams, getSession()]);

    const weekStart = mondayOf(parseDateParam(week));

    // Staff see only their own shifts, through the self-or-manager endpoint. The week nav sits
    // outside the boundary so the range stays put while the next week loads.
    if (session && session.role !== OWNER_ROLE && session.role !== MANAGER_ROLE) {
        return (
            <div className="flex flex-col gap-6">
                <h1 className="text-xl font-semibold">My attendance</h1>
                <WeekNav basePath="/attendance" weekStart={weekStart} thisWeek={mondayOf(todayDateString())} query={{}} />
                <Suspense key={weekStart} fallback={loading}>
                    <MyAttendance userId={session.userId} branchIds={session.branchIds} weekStart={weekStart} />
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

    const branchId = await getSelectedBranchId(branch, branches);
    const branchName = branches.find((b) => b.branchId === branchId)?.name;

    // a manager opens on one day; ?week= (old links included) asks for the whole week
    const view: AttendanceRange = week !== undefined ? "week" : "day";
    const from = view === "week" ? weekStart : parseDateParam(date);
    const to = view === "week" ? addDays(from, 6) : from;
    const rangeQuery: Record<string, string> = view === "week" ? { week: from } : { date: from };

    if (branches.length === 0) {
        return (
            <div className="flex flex-col gap-6">
                <h1 className="text-xl font-semibold">Attendance</h1>
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>No branches</EmptyTitle>
                        <EmptyDescription>Attendance is recorded per branch, and there are no branches to show.</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </div>
        );
    }

    // "All branches" in the top bar: one range bar, then every branch's attendance
    if (branchId === undefined) {
        return (
            <div className="flex flex-col gap-6">
                <h1 className="text-xl font-semibold">Attendance</h1>
                <RangeBar view={view} from={from} query={{}} />
                <BranchStack branches={branches} basePath="/attendance" query={rangeQuery}>
                    {(b) => (
                        <Suspense key={`${b.branchId}-${view}-${from}`} fallback={loading}>
                            <AttendanceSection branchId={b.branchId} from={from} to={to} view={view} stacked />
                        </Suspense>
                    )}
                </BranchStack>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-xl font-semibold">{`Attendance for ${branchName}`}</h1>
            <RangeBar view={view} from={from} query={{ branch: String(branchId) }} />
            <Suspense key={`${branchId}-${view}-${from}`} fallback={loading}>
                <AttendanceSection branchId={branchId} from={from} to={to} view={view} />
            </Suspense>
        </div>
    );
}
