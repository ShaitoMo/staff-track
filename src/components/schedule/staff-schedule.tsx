import { BranchFilter } from "@/components/layout/branch-filter";
import { BranchesFailedAlert, settledOrThrow } from "@/components/layout/branches-failed-alert";
import { TodayMark } from "@/components/layout/today-mark";
import { WeekNav } from "@/components/layout/week-nav";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { fetchApi } from "@/lib/api-server";
import { formatDay, mondayOf, weekDates } from "@/lib/coverage-rows";
import { todayDateString } from "@/lib/instance-rows";
import { branchRoster, MyShift, myShifts, RosterDay } from "@/lib/staff-schedule";
import { cn } from "@/lib/utils";
import { BranchScheduleView } from "@/types/shift";

function MyShiftList({ shifts, today, showBranch }: { shifts: MyShift[]; today: string; showBranch: boolean }) {
    if (shifts.length === 0) {
        return <p className="rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground">You&apos;re not on the schedule this week.</p>;
    }

    return (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {shifts.map((shift, index) => {
                const details = [shift.registerName, showBranch ? shift.branchName : null].filter((detail) => detail !== null);
                // a second shift on the same day leaves the day column blank, so days read as groups
                const firstOfDay = index === 0 || shifts[index - 1].date !== shift.date;
                return (
                    <li
                        key={shift.shiftId}
                        className={cn(
                            "flex min-h-16 items-center gap-4 px-4 py-3",
                            shift.date === today && "bg-muted",
                            shift.date < today && "text-muted-foreground",
                        )}
                    >
                        <div className="flex w-24 shrink-0 flex-col items-start gap-1 text-sm font-medium">
                            <span className={cn(!firstOfDay && "sr-only")}>{formatDay(shift.date)}</span>
                            {shift.date === today && firstOfDay ? <TodayMark /> : null}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{shift.periodName ?? "Custom hours"}</p>
                            {details.length > 0 ? <p className="truncate text-xs text-muted-foreground">{details.join(" · ")}</p> : null}
                        </div>
                        <span className="shrink-0 font-mono text-sm tabular-nums">
                            {shift.startTime}–{shift.endTime}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}

function Roster({ days, today, userId }: { days: RosterDay[]; today: string; userId: number }) {
    return (
        <ol className="divide-y divide-border rounded-lg border border-border bg-card">
            {days.map((day) => (
                <li key={day.date} className={cn("flex flex-col gap-2 px-4 py-3", day.date === today && "bg-muted")}>
                    <h3 className="flex items-center gap-2 text-sm font-medium" aria-current={day.date === today ? "date" : undefined}>
                        {formatDay(day.date)}
                        {day.date === today ? <TodayMark /> : null}
                    </h3>
                    {day.groups.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No one scheduled.</p>
                    ) : (
                        <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-2 text-sm">
                            {day.groups.map((group) => (
                                <div key={group.periodId ?? "custom"} className="col-span-2 grid grid-cols-subgrid">
                                    <dt className="pt-px text-xs font-medium text-muted-foreground">{group.name ?? "Other hours"}</dt>
                                    <dd>
                                        <ul className="flex flex-col gap-1">
                                            {group.people.map((person) => {
                                                const details = [
                                                    person.roleName,
                                                    person.registerName,
                                                    group.name === null ? `${person.startTime}–${person.endTime}` : null,
                                                ].filter((detail) => detail !== null);
                                                return (
                                                    <li key={person.shiftId}>
                                                        <span className={cn(person.userId === userId && "font-semibold")}>
                                                            {person.userId === userId ? "You" : person.name}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground"> · {details.join(" · ")}</span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    )}
                </li>
            ))}
        </ol>
    );
}

/**
 * The read-only schedule a staff member sees: their own shifts first, then who works each day at
 * one of their branches. One read per branch they belong to (in practice one or two), all together.
 */
export async function StaffSchedule({
    userId,
    branchIds,
    requestedBranchId,
    weekStart,
}: {
    userId: number;
    branchIds: number[];
    requestedBranchId?: number;
    weekStart: string;
}) {
    if (branchIds.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>No branch yet</EmptyTitle>
                    <EmptyDescription>You&apos;ll see the schedule once a manager adds you to a branch.</EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    // Settled, not all-or-nothing: one branch failing to load shouldn't hide the others, or the
    // viewer's own shifts there. Only when every branch fails does the error boundary take over.
    const results = await Promise.allSettled(
        branchIds.map((branchId) => fetchApi<BranchScheduleView>(`/api/branches/${branchId}/schedule?week_start=${weekStart}`)),
    );
    const { values: schedules, failed } = settledOrThrow(results);

    const active = schedules.find((schedule) => schedule.branch_id === requestedBranchId) ?? schedules[0];
    const today = todayDateString();
    const branchQuery: Record<string, string> = schedules.length > 1 ? { branch: String(active.branch_id) } : {};

    return (
        <div className="flex max-w-2xl flex-col gap-6">
            <WeekNav basePath="/schedule" weekStart={weekStart} thisWeek={mondayOf(today)} query={branchQuery} />
            <BranchesFailedAlert failed={failed} consequence="shifts there are missing below" />

            <section aria-labelledby="my-shifts" className="flex flex-col gap-3">
                <h2 id="my-shifts" className="text-base font-medium">Your shifts</h2>
                <MyShiftList shifts={myShifts(schedules, userId)} today={today} showBranch={schedules.length > 1} />
            </section>

            <section aria-labelledby="branch-roster" className="flex flex-col gap-3">
                <h2 id="branch-roster" className="text-base font-medium">Who&apos;s working at {active.branch_name}</h2>
                {schedules.length > 1 ? (
                    <BranchFilter
                        basePath="/schedule"
                        branches={schedules.map((schedule) => ({ branchId: schedule.branch_id, name: schedule.branch_name }))}
                        activeBranchId={active.branch_id}
                        extraQuery={{ week: weekStart }}
                        showAll={false}
                    />
                ) : null}
                <Roster days={branchRoster(active, weekDates(weekStart))} today={today} userId={userId} />
            </section>
        </div>
    );
}
