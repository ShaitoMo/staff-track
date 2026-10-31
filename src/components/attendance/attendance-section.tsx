import { AlertCircleIcon } from "lucide-react";
import { AddPunchDialog } from "@/components/attendance/add-punch-dialog";
import { AttendanceLog } from "@/components/attendance/attendance-log";
import { ImportAttendanceDialog } from "@/components/attendance/import-attendance-dialog";
import { AttendanceRange } from "@/components/attendance/range-switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/locales";
import { getI18n } from "@/i18n/server";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { buildAttendanceRows, formatLatestPunch } from "@/lib/attendance-rows";
import { formatDay, formatWeekRange } from "@/lib/coverage-rows";
import { todayDateString } from "@/lib/instance-rows";
import { AttendanceFreshnessView } from "@/types/attendance";
import { ScheduleVsActualRow } from "@/types/schedule-vs-actual";
import { SafeUser } from "@/types/user";

/** How far the clock data goes, and what that means for the shifts after it. */
function ClockDataNote({ latest, notImported, t, locale }: { latest: Date | null; notImported: number; t: Dictionary; locale: Locale }) {
    if (latest === null) {
        return <p className="text-sm text-muted-foreground">{t.attendance.noClockData}</p>;
    }

    return (
        <p className="text-sm text-muted-foreground">
            {t.attendance.clockDataThrough} <span className="font-medium text-foreground">{formatLatestPunch(latest, locale)}</span>.
            {notImported > 0 ? t.attendance.importToFill : null}
        </p>
    );
}

/**
 * One branch's day or week of scheduled shifts against what the clock recorded (FR6). All three reads fire
 * together; the dialogs get only the id/name pairs they need, not the full user records.
 */
export async function AttendanceSection({
    branchId,
    from,
    to,
    view,
    stacked = false,
}: {
    branchId: number;
    /** The day shown, or a week's Monday to Sunday; both inclusive. */
    from: string;
    to: string;
    view: AttendanceRange;
    /** True when several branches stack on one page, so each one's Import stays quiet (one blue per screen). */
    stacked?: boolean;
}) {
    const { t, locale } = await getI18n();
    let report: ScheduleVsActualRow[];
    let users: SafeUser[];
    let freshness: AttendanceFreshnessView;

    try {
        [report, users, freshness] = await Promise.all([
            fetchApi<ScheduleVsActualRow[]>(`/api/schedule-vs-actual?branch_id=${branchId}&from=${from}&to=${to}`),
            fetchApi<SafeUser[]>(`/api/users?branch_id=${branchId}`),
            fetchApi<AttendanceFreshnessView>(`/api/branches/${branchId}/attendance-freshness`),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return (
                <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertDescription>{t.attendance.noBranchAccess}</AlertDescription>
                </Alert>
            );
        }
        throw error;
    }

    const latest = freshness.latest_punch === null ? null : new Date(freshness.latest_punch);
    const rows = buildAttendanceRows(report, users, { latestPunches: new Map([[branchId, latest]]), words: t.attendance.rows });
    const staff = users
        .filter((user) => user.isActive)
        .map((user) => ({ userId: user.userId, name: user.name }))
        .toSorted((a, b) => a.name.localeCompare(b.name));
    const today = todayDateString();
    // a punch added while looking at another day or week is most likely for that one
    const defaultDate = today >= from && today <= to ? today : from;
    const range = view === "day" ? formatDay(from, locale) : formatWeekRange(from, locale);
    // "on Sat 24 Oct", but "5 Oct – 11 Oct" reads on its own
    const during = view === "day" ? t.attendance.onDay(range) : range;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <ClockDataNote t={t} locale={locale} latest={latest} notImported={rows.filter((row) => row.status === "not_imported").length} />
                <div className="flex flex-wrap items-center gap-2">
                    <AddPunchDialog branchId={branchId} staff={staff} defaultDate={defaultDate} />
                    <ImportAttendanceDialog branchId={branchId} quiet={stacked} />
                </div>
            </div>
            {rows.length === 0 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>{t.attendance.noShifts(during)}</EmptyTitle>
                        <EmptyDescription>{t.attendance.noShiftsDescription(during)}</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <AttendanceLog
                    rows={rows}
                    today={today}
                    range={range}
                    grouped={view === "week"}
                    branchId={branchId}
                    staff={staff}
                    defaultDate={defaultDate}
                />
            )}
        </div>
    );
}
