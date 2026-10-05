import { Prisma, Attendance as AttendanceRow } from "@prisma/client";
import { db } from "@/lib/db";
import { AttendanceView, CreateAttendanceInput } from "@/types/attendance";
import { DuplicateAttendanceError } from "@/exceptions/duplicate-attendance-error";

export interface ImportedPunch {
    userId: number;
    branchId: number;
    clockIn: Date | null;
    clockOut: Date | null;
}

export interface AttendanceFilters {
    userId?: number;
    branchId?: number;
    from?: Date;
    to?: Date;
}

export class AttendanceRepository {

    /**
     * Newest first. The window bounds `clock_in`, or `clock_out` for a punch that has no clock-in,
     * and that same end is what orders it — sorted here, since Postgres would put every missing
     * clock-in first regardless of when it happened.
     */
    static async getAttendance(filters: AttendanceFilters = {}): Promise<AttendanceView[]> {
        const { userId, branchId, from, to } = filters;

        const attendance = await db.attendance.findMany({
            where: {
                userId,
                branchId,
                OR: [
                    { clockIn: { gte: from, lt: to } },
                    { clockIn: null, clockOut: { gte: from, lt: to } },
                ],
            },
        });

        const when = (row: AttendanceRow) => (row.clockIn ?? row.clockOut)!.getTime();

        return attendance
            .toSorted((left, right) => when(right) - when(left) || right.attendanceId - left.attendanceId)
            .map(AttendanceRepository.toView);
    }

    /**
     * One upload: the batch row and every punch it produced, in a transaction so a half-written
     * import can't be left behind. `skipDuplicates` leans on the two unique keys, (userId, clockIn)
     * and (userId, clockOut), to make a re-uploaded file, or one listing the same punch twice, a
     * no-op — the returned count is what actually landed.
     */
    static async importAttendance(input: {
        fileName: string;
        importedBy: number;
        punches: ImportedPunch[];
    }): Promise<{ batchId: number; created: number }> {
        const { fileName, importedBy, punches } = input;

        return db.$transaction(async (tx) => {
            const batch = await tx.importBatch.create({
                data: { fileName, importedBy, rowCount: 0 },
            });

            const { count } = await tx.attendance.createMany({
                data: punches.map((punch) => ({
                    userId: punch.userId,
                    branchId: punch.branchId,
                    clockIn: punch.clockIn,
                    clockOut: punch.clockOut,
                    source: 'csv_import' as const,
                    importBatchId: batch.batchId,
                })),
                skipDuplicates: true,
            });

            await tx.importBatch.update({
                where: { batchId: batch.batchId },
                data: { rowCount: count },
            });

            return { batchId: batch.batchId, created: count };
        });
    }

    static async getAttendanceById(attendanceId: number): Promise<AttendanceView | null> {
        const attendance = await db.attendance.findUnique({ where: { attendanceId } });

        return attendance ? AttendanceRepository.toView(attendance) : null;
    }

    /** A row typed in by hand: always `manual`, never part of an import batch. */
    static async createAttendance(data: CreateAttendanceInput): Promise<AttendanceView> {
        return AttendanceRepository.refusingDuplicates(() => db.attendance.create({
            data: {
                userId: data.user_id,
                branchId: data.branch_id,
                clockIn: data.clock_in,
                clockOut: data.clock_out ?? null,
                source: 'manual',
                importBatchId: null,
            },
        }));
    }

    /** Sets the given ends; `source` stays as it was — the punch still came from where it came from. */
    static async updateAttendance(
        attendanceId: number,
        data: { clockIn?: Date; clockOut?: Date },
    ): Promise<AttendanceView> {
        return AttendanceRepository.refusingDuplicates(() => db.attendance.update({
            where: { attendanceId },
            data,
        }));
    }

    /** Either unique key — (userId, clockIn) or (userId, clockOut) — means the punch is already recorded. */
    private static async refusingDuplicates(write: () => Promise<AttendanceRow>): Promise<AttendanceView> {
        try {
            return AttendanceRepository.toView(await write());
        } catch (error: unknown) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new DuplicateAttendanceError()
            }
            throw error
        }
    }

    private static toView(attendance: AttendanceRow): AttendanceView {
        return {
            attendance_id: attendance.attendanceId,
            user_id: attendance.userId,
            branch_id: attendance.branchId,
            clock_in: attendance.clockIn,
            clock_out: attendance.clockOut,
            source: attendance.source,
            import_batch_id: attendance.importBatchId,
        };
    }
}
