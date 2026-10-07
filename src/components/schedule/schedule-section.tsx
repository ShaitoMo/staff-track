import Link from "next/link";
import { AlertCircleIcon, CircleCheckIcon } from "lucide-react";
import { CopyWeekButton, ScheduleGrid } from "@/components/schedule/schedule-grid";
import { WeekNav } from "@/components/layout/week-nav";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { addDays, formatDay, mondayOf, sortPeriods, weekDates } from "@/lib/coverage-rows";
import { todayDateString } from "@/lib/instance-rows";
import {
    buildOpenRegisterRows,
    buildRoleRows,
    indexWeek,
    NEEDS_DOT,
    rolesOnRegisters,
    slotsForClient,
    summarizeWeek,
    toOtherShifts,
    toStaff,
    WeekSummary,
} from "@/lib/schedule-grid";
import { CoverageRequirementView } from "@/types/coverage-requirement";
import { Register } from "@/types/register";
import { Role } from "@/types/role";
import { ShiftView } from "@/types/shift";
import { ShiftPeriodView } from "@/types/shift-period";
import { SafeUser } from "@/types/user";
import { cn } from "@/lib/utils";

function plural(count: number, one: string, many: string): string {
    return `${count} ${count === 1 ? one : many}`;
}

/** The week's open work in one line, so the red cells don't have to be counted by eye. */
function CoverageSummary({ summary }: { summary: WeekSummary }) {
    const gaps = [
        summary.shortSlots > 0
            ? `${plural(summary.shortSlots, "role slot", "role slots")} short (${plural(summary.peopleShort, "person", "people")})`
            : null,
        summary.unstaffedRegisters > 0 ? `${plural(summary.unstaffedRegisters, "register slot", "register slots")} unstaffed` : null,
        summary.crowdedRegisters > 0
            ? `${plural(summary.crowdedRegisters, "register slot has", "register slots have")} more than one person`
            : null,
    ].filter((gap) => gap !== null);

    if (gaps.length === 0) {
        return (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CircleCheckIcon className="size-4 shrink-0" aria-hidden="true" />
                Every slot this week is covered.
            </p>
        );
    }

    return (
        <p className="flex items-start gap-2 text-sm">
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
            <span>{gaps.join(" · ")}</span>
        </p>
    );
}

function LegendSwatch({ className }: { className: string }) {
    return <span aria-hidden="true" className={cn("h-3 w-5 shrink-0 rounded-sm border", className)} />;
}

/** Keys the grid's two tints; the register rule lives here too since the grid itself can't show it. */
function GridLegend() {
    return (
        <ul aria-label="Legend" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5">
                <span aria-hidden="true" className={NEEDS_DOT} />
                Needs people (the cell says how many)
            </li>
            <li className="flex items-center gap-1.5">
                <LegendSwatch className="border-foreground/20 bg-muted" />
                Today
            </li>
            <li className="flex items-center gap-1.5">
                <span aria-hidden="true" className="rounded-sm border border-foreground/15 bg-muted px-1 text-foreground">
                    Register 1
                </span>
                Working that register (click to change)
            </li>
        </ul>
    );
}

/**
 * One branch's week. Five reads, all fired together, each a single query on the server — nothing
 * here fetches per row, per day or per person.
 */
export async function ScheduleSection({
    branchId,
    weekStart,
    roles,
    showWeekNav = true,
}: {
    branchId: number;
    weekStart: string;
    roles: Role[];
    /** False when the page shows one week nav over several stacked branches. */
    showWeekNav?: boolean;
}) {
    const weekEnd = addDays(weekStart, 6);

    let periods: ShiftPeriodView[];
    let requirements: CoverageRequirementView[];
    let registers: Register[];
    let users: SafeUser[];
    let shifts: ShiftView[];

    try {
        [periods, requirements, registers, users, shifts] = await Promise.all([
            fetchApi<ShiftPeriodView[]>(`/api/periods?branchId=${branchId}`),
            fetchApi<CoverageRequirementView[]>(`/api/coverage-requirements?branchId=${branchId}`),
            fetchApi<Register[]>(`/api/branches/${branchId}/registers`),
            fetchApi<SafeUser[]>(`/api/users?branch_id=${branchId}`),
            fetchApi<ShiftView[]>(`/api/shifts?branch_id=${branchId}&from=${weekStart}&to=${weekEnd}`),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return (
                <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertDescription>You don&apos;t have access to this branch&apos;s schedule.</AlertDescription>
                </Alert>
            );
        }
        throw error;
    }

    const sortedPeriods = sortPeriods(periods);
    // One pass over the week, shared by every builder below.
    const week = indexWeek(shifts, users, registers);
    const roleRows = buildRoleRows(shifts, week, roles, sortedPeriods, requirements, weekStart);
    const openRegisterRows = buildOpenRegisterRows(week, registers, sortedPeriods, weekStart);
    const otherShifts = toOtherShifts(shifts, week);
    const today = todayDateString();
    const weekNav = showWeekNav ? (
        <WeekNav basePath="/schedule" weekStart={weekStart} thisWeek={mondayOf(today)} query={{ branch: String(branchId) }} />
    ) : null;

    if (sortedPeriods.length === 0) {
        return (
            <div className="flex flex-col gap-4">
                {weekNav}
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>No shift periods</EmptyTitle>
                        <EmptyDescription>The schedule is filled per shift period, and this branch has none yet.</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                {weekNav}
                <CopyWeekButton branchId={branchId} weekStart={weekStart} />
            </div>
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                <CoverageSummary summary={summarizeWeek(roleRows, openRegisterRows)} />
                <GridLegend />
            </div>
            {roleRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    No coverage requirements yet. Set how many people each role needs on{" "}
                    <Link href={`/roles?branch=${branchId}`} className="font-medium text-foreground underline underline-offset-4">
                        Roles
                    </Link>{" "}
                    to schedule by role; registers can still be filled below.
                </p>
            ) : null}
            <ScheduleGrid
                branchId={branchId}
                dates={weekDates(weekStart)}
                today={today}
                roleRows={roleRows}
                periods={sortedPeriods}
                openRegisterRows={openRegisterRows}
                hasRegisters={registers.length > 0}
                registerRoleIds={rolesOnRegisters(shifts, week)}
                staff={toStaff(users)}
                slots={slotsForClient(week)}
            />
            {otherShifts.length > 0 ? (
                <section aria-labelledby="custom-hours" className="flex flex-col gap-2 pt-2">
                    <h3 id="custom-hours" className="text-sm font-medium">
                        Custom-hours shifts
                        <span className="ml-2 text-xs font-normal text-muted-foreground">Not tied to a period, so not counted above</span>
                    </h3>
                    <div className="overflow-x-auto rounded-lg border border-border bg-card sm:max-w-xl">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead scope="col">Day</TableHead>
                                    <TableHead scope="col">Hours</TableHead>
                                    <TableHead scope="col">Person</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {otherShifts.map((shift) => (
                                    <TableRow key={shift.shiftId}>
                                        <TableCell>{formatDay(shift.date)}</TableCell>
                                        <TableCell className="font-mono tabular-nums">
                                            {shift.startTime}–{shift.endTime}
                                        </TableCell>
                                        <TableCell>{shift.name}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </section>
            ) : null}
        </div>
    );
}
