import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { UserBranch } from '@/types/user-branch';
import { DuplicateUserBranchError } from '@/exceptions/duplicate-user-branch-error';
import { UserBranchNotFoundError } from '@/exceptions/user-branch-not-found-error';
import { DuplicateMachineEmployeeIdError } from '@/exceptions/duplicate-machine-employee-id-error';

export interface UserBranchFilters {
    userId?: number;
    branchId?: number;
}

export class UserBranchRepository {
    static async getUserBranches(filters: UserBranchFilters = {}): Promise<UserBranch[]> {
        const userBranches = await db.userBranch.findMany({
            where: {
                userId: filters.userId,
                branchId: filters.branchId,
            },
            select: {
                userId: true,
                branchId: true,
                machineEmployeeId: true,
            },
        });

        return userBranches.map((userBranch) => ({
            userId: userBranch.userId,
            branchId: userBranch.branchId,
            machineEmployeeId: userBranch.machineEmployeeId ?? undefined,
        }));
    }
    static async assignUserToBranch({ userId, branchId, machineEmployeeId }: UserBranch): Promise<UserBranch> {
        try {
            const userBranch = await db.userBranch.create({
                data: {
                    userId,
                    branchId,
                    machineEmployeeId,
                },
                select: {
                    userId: true,
                    branchId: true,
                    machineEmployeeId: true,
                },
            });

            return {
                userId: userBranch.userId,
                branchId: userBranch.branchId,
                machineEmployeeId: userBranch.machineEmployeeId ?? undefined,
            };
        } catch (error: unknown) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                // two unique constraints here: the composite PK, and (branchId, machineEmployeeId)
                if (JSON.stringify(error.meta?.target ?? '').toLowerCase().includes('machine')) {
                    throw new DuplicateMachineEmployeeIdError()
                }
                throw new DuplicateUserBranchError()
            }
            throw error
        }
    }
    static async removeUserFromBranch(userId: number, branchId: number): Promise<void> {
        try {
            await db.userBranch.delete({
                where: {
                    userId_branchId: { userId, branchId },
                },
            });
        } catch (error: unknown) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025'
            ) {
                throw new UserBranchNotFoundError()
            }
            throw error
        }
    }
}
