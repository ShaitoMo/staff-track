import { Prisma, Shift as ShiftRow } from "@prisma/client";
import { db } from "@/lib/db";
import { toDateOnlyString } from "@/types/date-only";
import { CreateShiftInput, ShiftView, UpdateShiftInput } from "@/types/shift";
import { UserNotFoundError } from "@/exceptions/user-not-found-error";
import { ShiftNotFoundError } from "@/exceptions/shift-not-found-error";

export interface ShiftFilters {
    branchId?: number;
    userId?: number;
    registerId?: number;
    from?: Date;
    to?: Date;
}

export interface OverlapQuery {
    userId: number;
    shiftDate: Date;
    startTime: Date;
    endTime: Date;
    /** the shift being edited, which always overlaps itself */
    excludeShiftId?: number;
}

export class ShiftRepository {
    static async getShiftById(shiftId: number): Promise<ShiftView | null> {
        const shift = await db.shift.findUnique({
            where: { shiftId },
        })

        return shift ? ShiftRepository.toView(shift) : null
    }

    /**
     * The weekly schedule. Every filter is optional; Prisma drops `undefined` keys, so an
     * unfiltered call lists every shift. Ordered the way a schedule is read: day, then
     * start of shift.
     */
    static async getShifts(filters: ShiftFilters = {}): Promise<ShiftView[]> {
        const { branchId, userId, registerId, from, to } = filters;

        const shifts = await db.shift.findMany({
            where: {
                branchId,
                userId,
                registerId,
                shiftDate: { gte: from, lte: to },
            },
            orderBy: [{ shiftDate: 'asc' }, { startTime: 'asc' }, { shiftId: 'asc' }],
        });

        return shifts.map(ShiftRepository.toView);
    }

    /**
     * The same user's shifts on the same day whose span clashes with [startTime, endTime).
     *
     * Both intervals are treated as half-open, so `lt`/`gt` rather than `lte`/`gte`: a shift that
     * starts exactly when another ends is back-to-back, not a clash, and 09:00-17:00 followed by
     * 17:00-21:00 is a normal handover.
     *
     * Branch is deliberately not a filter — see ShiftService.assertNoDoubleBooking.
     */
    static async getOverlappingShifts(query: OverlapQuery): Promise<ShiftView[]> {
        const shifts = await db.shift.findMany({
            where: ShiftRepository.buildOverlapWhere(query),
            orderBy: [{ startTime: 'asc' }, { shiftId: 'asc' }],
        });

        return shifts.map(ShiftRepository.toView);
    }

    private static buildOverlapWhere(query: OverlapQuery): Prisma.ShiftWhereInput {
        const { userId, shiftDate, startTime, endTime, excludeShiftId } = query;

        return {
            userId,
            shiftDate,
            startTime: { lt: endTime },
            endTime: { gt: startTime },
            shiftId: excludeShiftId === undefined ? undefined : { not: excludeShiftId },
        };
    }

    /**
     * `span` carries the start/end actually being stored — CreateShiftInput's own start_time/
     * end_time are optional (a period can supply them instead), and ShiftService.createShift has
     * already resolved which pair wins by the time this is called.
     */
    static async createShift(
        data: CreateShiftInput,
        span: { startTime: Date; endTime: Date },
    ): Promise<ShiftView> {
        try {
            const shift = await db.shift.create({
                data: {
                    userId: data.user_id,
                    branchId: data.branch_id,
                    registerId: data.register_id ?? null,
                    periodId: data.period_id ?? null,
                    shiftDate: data.shift_date,
                    startTime: span.startTime,
                    endTime: span.endTime,
                    createdBy: data.created_by,
                },
            });

            return ShiftRepository.toView(shift);
        } catch (error: unknown) {
            // The service has already checked every other foreign key this row carries, so the
            // scheduling manager is the only one left that can still be missing.
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
                throw new UserNotFoundError('created_by is not an existing user')
            }
            throw error
        }
    }

    /**
     * Prisma drops `undefined` keys, so an absent field is left as it stands and only
     * `register_id: null` clears anything.
     */
    static async updateShift(shiftId: number, data: UpdateShiftInput): Promise<ShiftView> {
        try {
            const shift = await db.shift.update({
                where: { shiftId },
                data: {
                    userId: data.user_id,
                    branchId: data.branch_id,
                    registerId: data.register_id,
                    shiftDate: data.shift_date,
                    startTime: data.start_time,
                    endTime: data.end_time,
                },
            });

            return ShiftRepository.toView(shift);
        } catch (error: unknown) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw new ShiftNotFoundError()
            }
            throw error
        }
    }

    static async deleteShift(shiftId: number): Promise<void> {
        try {
            await db.shift.delete({
                where: { shiftId },
            });
        } catch (error: unknown) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw new ShiftNotFoundError()
            }
            throw error
        }
    }

    /**
     * `shift_date` is a Postgres `date` and `start_time`/`end_time` are `time`, all of which
     * Prisma hands back as Dates anchored at UTC — so both are formatted off the ISO string
     * rather than through local-time getters, which would shift them by the offset.
     */
    private static toView(shift: ShiftRow): ShiftView {
        return {
            shift_id: shift.shiftId,
            user_id: shift.userId,
            branch_id: shift.branchId,
            register_id: shift.registerId,
            period_id: shift.periodId,
            shift_date: toDateOnlyString(shift.shiftDate),
            start_time: ShiftRepository.toTimeOnlyString(shift.startTime),
            end_time: ShiftRepository.toTimeOnlyString(shift.endTime),
            created_by: shift.createdBy,
            created_at: shift.createdAt,
            updated_at: shift.updatedAt,
        };
    }

    /** Formats a `time` column to 'HH:MM'. */
    private static toTimeOnlyString(time: Date): string {
        return time.toISOString().slice(11, 16);
    }
}
