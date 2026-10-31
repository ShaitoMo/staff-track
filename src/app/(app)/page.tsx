import type { Metadata } from "next";
import { Suspense } from "react";
import { BranchesToday } from "@/components/dashboard/branches-today";
import { StaffToday } from "@/components/dashboard/staff-today";
import { DayNav } from "@/components/layout/day-nav";
import { Spinner } from "@/components/ui/spinner";
import type { Dictionary } from "@/i18n/dictionaries";
import { getDictionary } from "@/i18n/server";
import { parseDateParam, todayDateString } from "@/lib/instance-rows";
import { MANAGER_ROLE, OWNER_ROLE } from "@/lib/rbac";
import { getSession } from "@/lib/session";

const loading = (t: Dictionary) => (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> {t.dashboard.loading}
    </div>
);

/** The tab says what the page heading says, which depends on who's looking. */
export async function generateMetadata(): Promise<Metadata> {
    const [session, t] = await Promise.all([getSession(), getDictionary()]);
    const canManage = session?.role === OWNER_ROLE || session?.role === MANAGER_ROLE;
    return { title: canManage ? t.dashboard.title : t.dashboard.homeTitle };
}

/**
 * Home: owners and managers get the day across their branches, any day via `?date=`; staff get
 * their today and tomorrow. The day nav sits outside the boundary so the date stays put on load.
 */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ date?: string; branch?: string }> }) {
    const [{ date: dateParam, branch }, session, t] = await Promise.all([searchParams, getSession(), getDictionary()]);

    if (!session) {
        return null;
    }

    if (session.role !== OWNER_ROLE && session.role !== MANAGER_ROLE) {
        return (
            <div className="flex flex-col gap-6">
                <h1 className="text-xl font-semibold">{t.dashboard.homeTitle}</h1>
                <Suspense fallback={loading(t)}>
                    <StaffToday userId={session.userId} branchIds={session.branchIds} />
                </Suspense>
            </div>
        );
    }

    const today = todayDateString();
    const date = parseDateParam(dateParam);

    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-xl font-semibold">{t.dashboard.title}</h1>
            <DayNav basePath="/" date={date} today={today} />
            <Suspense key={`${date}-${branch}`} fallback={loading(t)}>
                <BranchesToday date={date} today={today} branchParam={branch} />
            </Suspense>
        </div>
    );
}
