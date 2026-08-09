import { db } from '@/lib/db';
import { UserBranch } from '@/types/user-branch';

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
}
