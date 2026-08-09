import { UserBranchFilters, UserBranchRepository } from '@/repository/user-branch-repository'
import { UserBranch } from '@/types/user-branch'

export class UserBranchService {
    static async getUserBranches(filters: UserBranchFilters = {}): Promise<UserBranch[]> {
        return UserBranchRepository.getUserBranches(filters)
    }
}
