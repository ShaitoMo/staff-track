jest.mock('@/lib/db', () => ({ db: {} }));
jest.mock('@/repository/branch-repository', () => ({
    BranchRepository: { assertExists: jest.fn(), getAllBranches: jest.fn() },
}));
jest.mock('@/repository/shift-repository', () => ({ ShiftRepository: { getShifts: jest.fn() } }));
jest.mock('@/repository/attendance-repository', () => ({ AttendanceRepository: { getAttendance: jest.fn() } }));
jest.mock('@/repository/task-instance-repository', () => ({
    TaskInstanceRepository: { getTaskInstances: jest.fn() },
}));

import { DashboardService } from '@/services/dashboard-service';
import { AttendanceRepository } from '@/repository/attendance-repository';
import { ShiftRepository } from '@/repository/shift-repository';
import { TaskInstanceRepository } from '@/repository/task-instance-repository';
import { ShiftView } from '@/types/shift';

const getShifts = ShiftRepository.getShifts as jest.Mock;

const EPOCH = new Date('1970-01-01T00:00:00.000Z');

function shift(id: number, startTime: string, endTime: string): ShiftView {
    return {
        shift_id: id,
        user_id: id,
        branch_id: 1,
        register_id: null,
        period_id: null,
        shift_date: '2026-10-06',
        start_time: startTime,
        end_time: endTime,
        created_by: 99,
        created_at: EPOCH,
        updated_at: EPOCH,
    };
}

beforeEach(() => {
    jest.useFakeTimers();
    // 12:00 in Beirut (+03:00) on 6 Oct 2026
    jest.setSystemTime(new Date('2026-10-06T09:00:00Z'));
    (AttendanceRepository.getAttendance as jest.Mock).mockResolvedValue([]);
    (TaskInstanceRepository.getTaskInstances as jest.Mock).mockResolvedValue([]);
});

afterEach(() => {
    jest.useRealTimers();
});

describe('DashboardService.getDashboard no-shows', () => {
    it('counts only shifts that have started — a later shift that day has not been missed yet', async () => {
        getShifts.mockResolvedValue([shift(1, '08:00', '16:00'), shift(2, '16:00', '23:00')]);

        const dashboard = await DashboardService.getDashboard({ branch_id: 1 });

        expect(dashboard.attendance.no_shows).toBe(1);
    });
});
