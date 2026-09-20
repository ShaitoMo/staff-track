import { Branch } from '@/types/branch'
import { BranchRepository } from '@/repository/branch-repository'
import { UserRepository } from '@/repository/user-repository'
import { UserBranchFilters, UserBranchRepository } from '@/repository/user-branch-repository'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { UserBranch } from '@/types/user-branch'

export class UserBranchService {
    static async getUserBranches(filters: UserBranchFilters = {}): Promise<UserBranch[]> {
        return UserBranchRepository.getUserBranches(filters)
    }

    static async getBranchesByUser(userId: number): Promise<Branch[]> {
        await UserRepository.assertExists(userId)
        return BranchRepository.getBranchesByUser(userId)
    }

    static async assignUserToBranch(data: UserBranch): Promise<UserBranch> {
        await UserRepository.assertExists(data.userId)
        await UserBranchService.assertBranchExists(data.branchId)
        return UserBranchRepository.assignUserToBranch(data)
    }

    static async removeUserFromBranch(userId: number, branchId: number): Promise<void> {
        return UserBranchRepository.removeUserFromBranch(userId, branchId)
    }

    private static async assertBranchExists(branchId: number): Promise<void> {
        const branch = await BranchRepository.getBranchById(branchId)

        if (!branch) {
            throw new BranchNotFoundError()
        }
    }
}
