import { BranchRepository } from '@/repository/branch-repository'
import { UserRepository } from '@/repository/user-repository'
import { UserBranchFilters, UserBranchRepository } from '@/repository/user-branch-repository'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { UserBranch } from '@/types/user-branch'

export class UserBranchService {
    static async getUserBranches(filters: UserBranchFilters = {}): Promise<UserBranch[]> {
        return UserBranchRepository.getUserBranches(filters)
    }

    static async assignUserToBranch(data: UserBranch): Promise<UserBranch> {
        await UserBranchService.assertUserExists(data.userId)
        await UserBranchService.assertBranchExists(data.branchId)
        return UserBranchRepository.assignUserToBranch(data)
    }

    static async removeUserFromBranch(userId: number, branchId: number): Promise<void> {
        return UserBranchRepository.removeUserFromBranch(userId, branchId)
    }

    private static async assertUserExists(userId: number): Promise<void> {
        const user = await UserRepository.getUserById(userId)

        if (!user) {
            throw new UserNotFoundError()
        }
    }

    private static async assertBranchExists(branchId: number): Promise<void> {
        const branch = await BranchRepository.getBranchById(branchId)

        if (!branch) {
            throw new BranchNotFoundError()
        }
    }
}
