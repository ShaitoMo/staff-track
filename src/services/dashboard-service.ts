import { BranchRepository } from '@/repository/branch-repository';
import { AttendanceRepository } from '@/repository/attendance-repository';
import { ShiftRepository } from '@/repository/shift-repository';
import { TaskInstanceRepository } from '@/repository/task-instance-repository';
import { compareScheduleWithAttendance, scheduledInstant } from '@/lib/schedule-vs-actual';
import { machineDayOf } from '@/lib/machine-time';
import { DashboardFiltersInput, DashboardResponse } from '@/types/dashboard';
import { toDateOnlyString } from '@/types/date-only';
import { InvalidDateRangeError } from '@/exceptions/invalid-date-range-error';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class DashboardService {

    /** Attendance, task and attendance-coverage totals for a range, scoped to one branch or all of them (FR11). */
    static async getDashboard(filters: DashboardFiltersInput): Promise<DashboardResponse> {
        const { branch_id: branchId, from: fromInput, to: toInput } = filters;

        if (branchId !== undefined) {
            await BranchRepository.assertExists(branchId);
        }

        const today = machineDayOf(new Date());
        const from = fromInput ?? today;
        const to = toInput ?? today;

        // The schema only compares from/to when both are given, since either can default to
        // today — a default landing on the wrong side of the other one still needs to be caught.
        if (to < from) {
            throw new InvalidDateRangeError();
        }

        const [branches, shifts, punches, instances] = await Promise.all([
            branchId !== undefined ? [] : BranchRepository.getAllBranches(),
            ShiftRepository.getShifts({ branchId, from, to }),
            AttendanceRepository.getAttendance({
                branchId,
                // Wider than the range on both ends, same reasoning as ScheduleVsActualService:
                // shifts are filtered by calendar date, punches by instant.
                from: new Date(from.getTime() - MS_PER_DAY),
                to: new Date(to.getTime() + 2 * MS_PER_DAY),
            }),
            TaskInstanceRepository.getTaskInstances({ branchId, dueFrom: from, dueTo: to }),
        ]);

        const now = new Date();
        const rows = compareScheduleWithAttendance(shifts, punches, now);
        // The report calls any shift without punches a no-show; one that hasn't started yet hasn't
        // been missed — the attendance page shows it as upcoming — so it isn't counted here.
        const noShows = rows.filter(
            (row) => row.flag === 'no_show' && scheduledInstant(row.shift_date, row.scheduled_start) <= now,
        );

        const coverageBranchIds = branchId !== undefined
            ? [branchId]
            : branches.map((branch) => branch.branchId);

        const attendanceCoverage = coverageBranchIds.map((id) => {
            const branchRows = rows.filter((row) => row.branch_id === id);

            return {
                branch_id: id,
                shifts_scheduled: branchRows.length,
                shifts_covered: branchRows.filter((row) => row.flag !== 'no_show').length,
            };
        });

        return {
            branch_id: branchId ?? null,
            range: { from: toDateOnlyString(from), to: toDateOnlyString(to) },
            attendance: {
                no_shows: noShows.length,
                // Read is_late / left_early, not the flag: a punch missing an end outranks lateness
                // in the flag, yet a late arrival who forgot to clock out was still late. A shift both
                // late and left early counts in both, as the attendance page does.
                late_arrivals: rows.filter((row) => row.is_late).length,
                early_departures: rows.filter((row) => row.left_early).length,
                incomplete_punches: rows.filter(
                    (row) => row.flag === 'missing_clock_in' || row.flag === 'missing_clock_out',
                ).length,
            },
            tasks: {
                pending: instances.filter((instance) => instance.status === 'pending').length,
                completed: instances.filter((instance) => instance.status === 'completed').length,
                verified: instances.filter((instance) => instance.status === 'verified').length,
                rejected: instances.filter((instance) => instance.status === 'rejected').length,
            },
            attendance_coverage: attendanceCoverage,
        };
    }
}
