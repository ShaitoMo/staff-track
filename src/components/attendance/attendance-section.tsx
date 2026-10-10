import { AlertCircleIcon } from "lucide-react";
import { AddPunchDialog } from "@/components/attendance/add-punch-dialog";
import { StatusBadge, StatusSummary } from "@/components/attendance/attendance-status";
import { FixPunchDialog } from "@/components/attendance/fix-punch-dialog";
import { ImportAttendanceDialog } from "@/components/attendance/import-attendance-dialog";
import { WeekNav } from "@/components/layout/week-nav";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { buildAttendanceRows, summarizeStatuses } from "@/lib/attendance-rows";
import { addDays, formatDay, mondayOf } from "@/lib/coverage-rows";
import { todayDateString } from "@/lib/instance-rows";
import { ScheduleVsActualRow } from "@/types/schedule-vs-actual";
import { SafeUser } from "@/types/user";

/**
 * One branch's week of scheduled shifts against what the clock recorded (FR6). Both reads fire
 * together; the dialogs get only the id/name pairs they need, not the full user records.
 */
export async function AttendanceSection({ branchId, weekStart }: { branchId: number; weekStart: string }) {
    const weekEnd = addDays(weekStart, 6);

    let report: ScheduleVsActualRow[];
    let users: SafeUser[];

    try {
        [report, users] = await Promise.all([
            fetchApi<ScheduleVsActualRow[]>(`/api/schedule-vs-actual?branch_id=${branchId}&from=${weekStart}&to=${weekEnd}`),
            fetchApi<SafeUser[]>(`/api/users?branch_id=${branchId}`),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return (
                <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertDescription>You don&apos;t have access to this branch&apos;s attendance.</AlertDescription>
                </Alert>
            );
        }
        throw error;
    }

    const rows = buildAttendanceRows(report, users);
    const staff = users
        .filter((user) => user.isActive)
        .map((user) => ({ userId: user.userId, name: user.name }))
        .toSorted((a, b) => a.name.localeCompare(b.name));
    const today = todayDateString();

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <WeekNav basePath="/attendance" weekStart={weekStart} thisWeek={mondayOf(today)} query={{ branch: String(branchId) }} />
                <div className="flex flex-wrap items-center gap-2">
                    <AddPunchDialog branchId={branchId} staff={staff} defaultDate={today} />
                    <ImportAttendanceDialog branchId={branchId} />
                </div>
            </div>
            {rows.length === 0 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>No shifts this week</EmptyTitle>
                        <EmptyDescription>
                            Attendance is compared against the schedule, and nobody is scheduled at this branch this week.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <>
                    <StatusSummary counts={summarizeStatuses(rows)} />
                    <div className="overflow-x-auto rounded-lg border border-border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead scope="col">Day</TableHead>
                                    <TableHead scope="col">Person</TableHead>
                                    <TableHead scope="col">Scheduled</TableHead>
                                    <TableHead scope="col">In</TableHead>
                                    <TableHead scope="col">Out</TableHead>
                                    <TableHead scope="col">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((row) => (
                                    <TableRow key={row.shiftId}>
                                        <TableCell>{formatDay(row.shiftDate)}</TableCell>
                                        <TableCell>{row.name}</TableCell>
                                        <TableCell className="font-mono tabular-nums">{row.scheduled}</TableCell>
                                        <TableCell className="font-mono tabular-nums">{row.clockIn ?? "—"}</TableCell>
                                        <TableCell className="font-mono tabular-nums">{row.clockOut ?? "—"}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <StatusBadge status={row.status} detail={row.detail} />
                                                {row.fix !== null ? (
                                                    <FixPunchDialog
                                                        attendanceId={row.fix.attendanceId}
                                                        end={row.fix.end}
                                                        name={row.name}
                                                        shiftDate={row.shiftDate}
                                                        scheduledStart={row.scheduledStart}
                                                    />
                                                ) : null}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </>
            )}
        </div>
    );
}
