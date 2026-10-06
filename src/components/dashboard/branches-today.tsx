import Link from "next/link";
import { AccessMessage } from "@/components/layout/access-message";
import { BranchesFailedAlert, settledOrThrow } from "@/components/layout/branches-failed-alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { mondayOf } from "@/lib/coverage-rows";
import { BranchDay, branchDay } from "@/lib/dashboard-day";
import { cn } from "@/lib/utils";
import { Branch } from "@/types/branch";
import { CoverageGapRow } from "@/types/coverage-gap";
import { DashboardResponse } from "@/types/dashboard";
import { Role } from "@/types/role";
import { BranchScheduleView } from "@/types/shift";

interface BranchSummary {
    branchId: number;
    name: string;
    day: BranchDay;
    stats: Pick<DashboardResponse, "attendance" | "tasks">;
}

/** A labelled count; red only for what needs someone to act (DESIGN.md: status is never Market Blue). */
function Stat({ label, value, urgent = false }: { label: string; value: number; urgent?: boolean }) {
    return (
        <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className={cn("text-lg font-semibold tabular-nums", urgent && value > 0 && "text-destructive")}>{value}</dd>
        </div>
    );
}

/**
 * One line of a card's stat block: '1 no-show', '2 no-shows', with the zero cases left quiet. A
 * noun takes a [singular, plural] pair; 'late' or 'pending' reads the same either way.
 */
function StatLine({ count, label, urgent = false }: { count: number; label: string | [string, string]; urgent?: boolean }) {
    const text = typeof label === "string" ? label : label[count === 1 ? 0 : 1];

    return (
        <li className={cn(count === 0 ? "text-muted-foreground" : urgent && "text-destructive")}>
            <span className="tabular-nums">{count}</span> {text}
        </li>
    );
}

function BranchCard({ branch, week }: { branch: BranchSummary; week: string }) {
    const { day, stats } = branch;

    return (
        <section aria-labelledby={`branch-${branch.branchId}`} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
            <header className="flex items-baseline justify-between gap-3">
                <h3 id={`branch-${branch.branchId}`} className="text-base font-medium">
                    <Link href={`/schedule?branch=${branch.branchId}&week=${week}`} className="hover:text-primary hover:underline underline-offset-4">
                        {branch.name}
                    </Link>
                </h3>
                <span className="text-sm text-muted-foreground tabular-nums">{day.staffCount} scheduled</span>
            </header>

            {day.periods.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nobody is scheduled.</p>
            ) : (
                <ul className="divide-y divide-border text-sm">
                    {day.periods.map((period) => (
                        <li key={period.periodId ?? "custom"} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2 first:pt-0">
                            <span className="font-medium">{period.name ?? "Other hours"}</span>
                            <span className="text-muted-foreground">
                                <span className="tabular-nums">{period.staffCount}</span> scheduled ·{" "}
                                {period.managers.length > 0 ? (
                                    <span className="text-foreground">Manager: {period.managers.join(", ")}</span>
                                ) : (
                                    "No manager scheduled"
                                )}
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 text-sm sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                    <Link href={`/attendance?branch=${branch.branchId}&week=${week}`} className="text-xs font-medium text-muted-foreground hover:text-primary">
                        Attendance
                    </Link>
                    <ul className="flex flex-col gap-0.5">
                        <StatLine count={stats.attendance.no_shows} label={["no-show", "no-shows"]} urgent />
                        <StatLine count={stats.attendance.late_arrivals} label="late" />
                        <StatLine count={stats.attendance.early_departures} label="left early" />
                        <StatLine count={stats.attendance.incomplete_punches} label={["missing punch", "missing punches"]} urgent />
                    </ul>
                </div>
                <div className="flex flex-col gap-1">
                    <Link href={`/tasks?branch=${branch.branchId}`} className="text-xs font-medium text-muted-foreground hover:text-primary">
                        Tasks due
                    </Link>
                    <ul className="flex flex-col gap-0.5">
                        <StatLine count={stats.tasks.pending} label="pending" />
                        <StatLine count={stats.tasks.completed} label="to review" />
                        <StatLine count={stats.tasks.verified} label="verified" />
                        <StatLine count={stats.tasks.rejected} label="rejected" />
                    </ul>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground">Open slots</span>
                    {day.openSlots.length === 0 ? (
                        // not 'fully covered': a branch with no requirements set has no gaps either
                        <p className="text-muted-foreground">No open slots</p>
                    ) : (
                        <ul className="flex flex-col gap-0.5">
                            {day.openSlots.map((slot) => (
                                <li key={`${slot.periodName}-${slot.roleName}`}>
                                    {slot.periodName}: <span className="tabular-nums">{slot.short}</span> {slot.roleName} short
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </section>
    );
}

/**
 * The day across every branch the viewer runs — all of them for an owner, their own for a
 * manager (GET /api/branches is already scoped). Everything is who is *scheduled*: attendance
 * imports lag the day, so this never claims who is in right now. All reads fire together, settled
 * per branch so one failing branch doesn't hide the rest.
 */
export async function BranchesToday({ date }: { date: string }) {
    const week = mondayOf(date);
    let branches: Branch[];
    let roles: Role[];

    try {
        [branches, roles] = await Promise.all([fetchApi<Branch[]>("/api/branches"), fetchApi<Role[]>("/api/roles")]);
    } catch (error) {
        // a role changed within the token's 10 minutes
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title="Dashboard" message="You don't have access to the dashboard." />;
        }
        throw error;
    }

    if (branches.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>No branches</EmptyTitle>
                    <EmptyDescription>The dashboard summarises each branch you run, and there are none yet.</EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    const { values: summaries, failed } = settledOrThrow(
        await Promise.allSettled(
            branches.map(async (branch): Promise<BranchSummary> => {
                const [schedule, stats, gaps] = await Promise.all([
                    fetchApi<BranchScheduleView>(`/api/branches/${branch.branchId}/schedule?week_start=${week}`),
                    fetchApi<DashboardResponse>(`/api/dashboard?branch_id=${branch.branchId}&from=${date}&to=${date}`),
                    fetchApi<CoverageGapRow[]>(`/api/branches/${branch.branchId}/coverage?weekStart=${week}`),
                ]);
                return { branchId: branch.branchId, name: branch.name, day: branchDay(schedule, date, gaps, roles), stats };
            }),
        ),
    );

    const total = (pick: (summary: BranchSummary) => number) => summaries.reduce((sum, summary) => sum + pick(summary), 0);

    return (
        <div className="flex flex-col gap-6">
            <BranchesFailedAlert failed={failed} consequence="they aren't shown below or in the totals" />
            <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-3 lg:grid-cols-6">
                <Stat label="Staff scheduled" value={total((s) => s.day.staffCount)} />
                <Stat label="No-shows" value={total((s) => s.stats.attendance.no_shows)} urgent />
                <Stat label="Late" value={total((s) => s.stats.attendance.late_arrivals)} />
                <Stat label="Missing punches" value={total((s) => s.stats.attendance.incomplete_punches)} urgent />
                <Stat label="Tasks pending" value={total((s) => s.stats.tasks.pending)} />
                <Stat label="Open slots" value={total((s) => s.day.openSlots.reduce((sum, slot) => sum + slot.short, 0))} />
            </dl>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {summaries.map((summary) => (
                    <BranchCard key={summary.branchId} branch={summary} week={week} />
                ))}
            </div>
        </div>
    );
}
