import { Suspense } from "react";
import { BranchesToday } from "@/components/dashboard/branches-today";
import { StaffToday } from "@/components/dashboard/staff-today";
import { DayNav } from "@/components/layout/day-nav";
import { Spinner } from "@/components/ui/spinner";
import { parseDateParam, todayDateString } from "@/lib/instance-rows";
import { MANAGER_ROLE, OWNER_ROLE } from "@/lib/rbac";
import { getSession } from "@/lib/session";

const loading = (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
    </div>
);

/**
 * Home: owners and managers get the day across their branches, any day via `?date=`; staff get
 * their today and tomorrow. The day nav sits outside the boundary so the date stays put on load.
 */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
    const [{ date: dateParam }, session] = await Promise.all([searchParams, getSession()]);

    if (!session) {
        return null;
    }

    if (session.role !== OWNER_ROLE && session.role !== MANAGER_ROLE) {
        return (
            <div className="flex flex-col gap-6">
                <h1 className="text-xl font-medium">Home</h1>
                <Suspense fallback={loading}>
                    <StaffToday userId={session.userId} branchIds={session.branchIds} />
                </Suspense>
            </div>
        );
    }

    const today = todayDateString();
    const date = parseDateParam(dateParam);

    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-xl font-medium">Dashboard</h1>
            <DayNav basePath="/" date={date} today={today} />
            <Suspense key={date} fallback={loading}>
                <BranchesToday date={date} today={today} />
            </Suspense>
        </div>
    );
}
