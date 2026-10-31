import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { AccessMessage } from "@/components/layout/access-message";
import { BranchesFailedAlert, settledOrThrow } from "@/components/layout/branches-failed-alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import type { Dictionary } from "@/i18n/dictionaries";
import { isolate } from "@/i18n/locales";
import { getDictionary } from "@/i18n/server";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { getSelectedBranchId } from "@/lib/session";
import { mondayOf } from "@/lib/coverage-rows";
import { BranchDay, branchDay, DayPeriod } from "@/lib/dashboard-day";
import { NEEDS_DOT } from "@/lib/schedule-grid";
import { TOUCH_HEIGHT } from "@/lib/touch";
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

const sentenceCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** A link that looks like one before hover: a chevron says 'this opens the page behind it'. */
const pageLinkClass = "inline-flex items-center gap-0.5 underline-offset-4 hover:text-primary hover:underline";

/** Periods somebody works or still needs filling, but with no manager scheduled. */
const unmanaged = (day: BranchDay) => day.periods.filter((period) => period.managers.length === 0);

/**
 * What needs someone, in the order to act on it. Attendance only counts once the day is past —
 * before that, the clock's import hasn't come in and its zeros would read as good news.
 */
function problemsOf({ day, stats }: BranchSummary, attendanceIn: boolean, t: Dictionary): string[] {
    const missing = unmanaged(day);

    return [
        day.shortTotal > 0 ? t.dashboard.slotsShort(day.shortTotal) : null,
        missing.length > 0
            ? t.dashboard.noManagerOn(missing.map((period) => (period.name === null ? t.dashboard.otherHoursLower : isolate(period.name))).join(t.common.listSeparator))
            : null,
        attendanceIn && stats.attendance.no_shows > 0 ? t.dashboard.noShows(stats.attendance.no_shows) : null,
        attendanceIn && stats.attendance.incomplete_punches > 0 ? t.dashboard.missingPunches(stats.attendance.incomplete_punches) : null,
    ].filter((problem) => problem !== null);
}

/** A labelled total; a red dot (not red digits) on what needs someone to act. `null` is a figure not known yet. */
function Stat({ label, value, urgent = false }: { label: string; value: number | null; urgent?: boolean }) {
    return (
        <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className={cn("flex items-center gap-2 text-lg font-semibold tabular-nums", value === null && "text-muted-foreground")}>
                {urgent && value !== null && value > 0 ? <span aria-hidden="true" className={NEEDS_DOT} /> : null}
                {value ?? "—"}
            </dd>
        </div>
    );
}

/** The non-zero counts of a column as short lines; when every one is zero, a single quiet line. */
function Counts({ lines, none }: { lines: { count: number; text: string; urgent?: boolean }[]; none: string }) {
    const shown = lines.filter((line) => line.count > 0);

    if (shown.length === 0) {
        return <p className="text-muted-foreground">{none}</p>;
    }

    return (
        <ul className="flex flex-col gap-0.5">
            {shown.map((line) => (
                <li key={line.text} className={cn(line.urgent && "text-destructive")}>
                    {line.text}
                </li>
            ))}
        </ul>
    );
}

/**
 * 'Morning · 3 scheduled · Manager: Alice', then what's still missing there, marked the way the
 * schedule grid marks it (NEEDS_DOT). The card's red summary line already names every problem once,
 * so nothing here repeats it in red.
 */
function PeriodRow({ period, t }: { period: DayPeriod; t: Dictionary }) {
    return (
        <li className="flex flex-col gap-0.5 py-2 first:pt-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-medium">{period.name ?? t.dashboard.otherHours}</span>
                {period.staffCount === 0 ? (
                    <span className="text-muted-foreground">{t.dashboard.nobodyScheduled}</span>
                ) : (
                    <span className="text-muted-foreground">
                        {t.dashboard.scheduled(period.staffCount)} ·{" "}
                        {period.managers.length > 0 ? (
                            <span className="text-foreground">{t.dashboard.managerList(period.managers.map(isolate).join(t.common.listSeparator))}</span>
                        ) : (
                            t.dashboard.noManagerScheduled
                        )}
                    </span>
                )}
            </div>
            {period.shortages.length > 0 ? (
                <p className="flex items-center gap-1.5 text-muted-foreground">
                    <span aria-hidden="true" className={NEEDS_DOT} />
                    {t.dashboard.short(period.shortages.map((item) => `${item.short} ${isolate(item.roleName)}`).join(t.common.listSeparator))}
                </p>
            ) : null}
        </li>
    );
}

function BranchCard({ branch, date, week, attendanceIn, t }: { branch: BranchSummary; date: string; week: string; attendanceIn: boolean; t: Dictionary }) {
    const { day, stats } = branch;
    const problems = problemsOf(branch, attendanceIn, t);

    return (
        <section aria-labelledby={`branch-${branch.branchId}`} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
            <header className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3">
                    <h2 id={`branch-${branch.branchId}`} className="text-base font-medium">
                        <Link href={`/schedule?branch=${branch.branchId}&week=${week}`} className={pageLinkClass}>
                            {branch.name}
                            <ChevronRightIcon aria-hidden className="size-4 text-muted-foreground rtl:rotate-180" />
                        </Link>
                    </h2>
                    <span className="text-sm text-muted-foreground tabular-nums">{t.dashboard.scheduled(day.staffCount)}</span>
                </div>
                <p className={cn("text-sm", problems.length > 0 ? "text-destructive" : "text-muted-foreground")}>
                    {problems.length > 0 ? sentenceCase(problems.join(" · ")) : t.dashboard.noIssues}
                </p>
            </header>

            {day.periods.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.dashboard.nobodyAndNoRequirement}</p>
            ) : (
                <ul className="divide-y divide-border text-sm">
                    {day.periods.map((period) => (
                        <PeriodRow key={period.periodId ?? "custom"} period={period} t={t} />
                    ))}
                </ul>
            )}

            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm">
                <div className="flex flex-col gap-1">
                    <Link href={`/attendance?branch=${branch.branchId}&week=${week}`} className={cn(pageLinkClass, "w-fit text-xs font-medium text-muted-foreground", TOUCH_HEIGHT)}>
                        {t.dashboard.attendance}
                        <ChevronRightIcon aria-hidden className="size-3.5 rtl:rotate-180" />
                    </Link>
                    {attendanceIn ? (
                        <Counts
                            none={t.dashboard.noIssues}
                            lines={[
                                { count: stats.attendance.no_shows, text: t.dashboard.noShows(stats.attendance.no_shows), urgent: true },
                                { count: stats.attendance.late_arrivals, text: t.dashboard.late(stats.attendance.late_arrivals) },
                                { count: stats.attendance.early_departures, text: t.dashboard.leftEarly(stats.attendance.early_departures) },
                                {
                                    count: stats.attendance.incomplete_punches,
                                    text: t.dashboard.missingPunches(stats.attendance.incomplete_punches),
                                    urgent: true,
                                },
                            ]}
                        />
                    ) : (
                        <p className="text-muted-foreground">{t.dashboard.notImportedYet}</p>
                    )}
                </div>
                <div className="flex flex-col gap-1">
                    <Link
                        href={`/tasks?view=instances&branch=${branch.branchId}&date=${date}`}
                        className={cn(pageLinkClass, "w-fit text-xs font-medium text-muted-foreground", TOUCH_HEIGHT)}
                    >
                        {t.dashboard.tasksDue}
                        <ChevronRightIcon aria-hidden className="size-3.5 rtl:rotate-180" />
                    </Link>
                    <Counts
                        none={t.dashboard.nothingDue}
                        lines={[
                            { count: stats.tasks.pending, text: t.dashboard.pending(stats.tasks.pending) },
                            { count: stats.tasks.completed, text: t.dashboard.toReview(stats.tasks.completed) },
                            { count: stats.tasks.verified, text: t.dashboard.verified(stats.tasks.verified) },
                            { count: stats.tasks.rejected, text: t.dashboard.rejected(stats.tasks.rejected) },
                        ]}
                    />
                </div>
            </div>
        </section>
    );
}

/**
 * The day across the branch chosen in the top bar, or every branch the viewer runs — all of them
 * for an owner, their own for a manager (GET /api/branches is already scoped). Everything is who is *scheduled*, and attendance
 * shows only for days already past: imports lag the day, so this never claims who is in right
 * now. Branches with something to act on come first. Reads fire together, settled per branch so
 * one failing branch doesn't hide the rest.
 */
export async function BranchesToday({ date, today, branchParam }: { date: string; today: string; branchParam?: string }) {
    const t = await getDictionary();
    const week = mondayOf(date);
    const attendanceIn = date < today;
    let branches: Branch[];
    let roles: Role[];

    try {
        [branches, roles] = await Promise.all([fetchApi<Branch[]>("/api/branches"), fetchApi<Role[]>("/api/roles")]);
    } catch (error) {
        // a role changed within the token's 10 minutes
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title={t.dashboard.title} message={t.dashboard.noAccess} />;
        }
        throw error;
    }

    if (branches.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>{t.dashboard.noBranches}</EmptyTitle>
                    <EmptyDescription>{t.dashboard.noBranchesDescription}</EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    // the top bar's branch, or every branch for "All branches"
    const selectedId = await getSelectedBranchId(branchParam, branches);
    const shown = selectedId === undefined ? branches : branches.filter((branch) => branch.branchId === selectedId);

    let values: BranchSummary[];
    let failed: number;

    try {
        ({ values, failed } = settledOrThrow(
            await Promise.allSettled(
                shown.map(async (branch): Promise<BranchSummary> => {
                    const [schedule, stats, gaps] = await Promise.all([
                        fetchApi<BranchScheduleView>(`/api/branches/${branch.branchId}/schedule?week_start=${week}`),
                        fetchApi<DashboardResponse>(`/api/dashboard?branch_id=${branch.branchId}&from=${date}&to=${date}`),
                        fetchApi<CoverageGapRow[]>(`/api/branches/${branch.branchId}/coverage?weekStart=${week}`),
                    ]);
                    return { branchId: branch.branchId, name: branch.name, day: branchDay(schedule, date, gaps, roles), stats };
                }),
            ),
        ));
    } catch (error) {
        // every branch failed, likely on the same lapsed role as above: same message, not the error boundary
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title={t.dashboard.title} message={t.dashboard.noAccess} />;
        }
        throw error;
    }
    // stable, so branches keep their own order within each group
    const summaries = values.toSorted(
        (a, b) => Number(problemsOf(b, attendanceIn, t).length > 0) - Number(problemsOf(a, attendanceIn, t).length > 0),
    );

    const total = (pick: (summary: BranchSummary) => number) => summaries.reduce((sum, summary) => sum + pick(summary), 0);
    const attendanceTotal = (pick: (summary: BranchSummary) => number) => (attendanceIn ? total(pick) : null);

    return (
        <div className="flex flex-col gap-6">
            <BranchesFailedAlert failed={failed} consequence={t.dashboard.failedConsequence} />
            {/* one branch's totals would only repeat its card */}
            {summaries.length > 1 ? (
                <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-3 lg:grid-cols-6">
                    <Stat label={t.dashboard.statStaffScheduled} value={total((s) => s.day.staffCount)} />
                    <Stat label={t.dashboard.statSlotsShort} value={total((s) => s.day.shortTotal)} urgent />
                    <Stat label={t.dashboard.statNoManager} value={total((s) => unmanaged(s.day).length)} urgent />
                    <Stat label={t.dashboard.statNoShows} value={attendanceTotal((s) => s.stats.attendance.no_shows)} urgent />
                    <Stat label={t.dashboard.statMissingPunches} value={attendanceTotal((s) => s.stats.attendance.incomplete_punches)} urgent />
                    <Stat label={t.dashboard.statTasksPending} value={total((s) => s.stats.tasks.pending)} />
                </dl>
            ) : null}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {summaries.map((summary) => (
                    <BranchCard key={summary.branchId} branch={summary} date={date} week={week} attendanceIn={attendanceIn} t={t} />
                ))}
            </div>
        </div>
    );
}
