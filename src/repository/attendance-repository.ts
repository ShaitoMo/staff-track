import { Prisma, Attendance as AttendanceRow } from "@prisma/client";
import { db } from "@/lib/db";
import { AttendanceView, CreateAttendanceInput } from "@/types/attendance";
import { DuplicateAttendanceError } from "@/exceptions/duplicate-attendance-error";

export interface ImportedPunch {
    userId: number;
    branchId: number;
    clockIn: Date;
    clockOut: Date | null;
}

export interface AttendanceFilters {
    userId?: number;
    branchId?: number;
    from?: Date;
    to?: Date;
}

export class AttendanceRepository {

    static async getAttendance(filters: AttendanceFilters = {}): Promise<AttendanceView[]> {
        const { userId, branchId, from, to } = filters;

        const attendance = await db.attendance.findMany({
            where: {
                userId,
                branchId,
                clockIn: { gte: from, lt: to },
            },
            orderBy: [{ clockIn: 'desc' }, { attendanceId: 'desc' }],
        });

        return attendance.map(AttendanceRepository.toView);
    }

    /**
     * One upload: the batch row and every punch it produced, in a transaction so a half-written
     * import cannot be left behind.
     *
     * `skipDuplicates` leans on @@unique([userId, clockIn]) to make re-uploading the same file a
     * no-op instead of an error — the rows already recorded are simply not inserted again, and the
     * count that comes back is what actually landed.
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

    /** A row typed in by hand: always `manual`, never part of an import batch. */
    static async createAttendance(data: CreateAttendanceInput): Promise<AttendanceView> {
        try {
            const attendance = await db.attendance.create({
                data: {
                    userId: data.user_id,
                    branchId: data.branch_id,
                    clockIn: data.clock_in,
                    clockOut: data.clock_out ?? null,
                    source: 'manual',
                    importBatchId: null,
                },
            });

            return AttendanceRepository.toView(attendance);
        } catch (error: unknown) {
            // @@unique([userId, clockIn]) — re-entering a punch that is already recorded
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
