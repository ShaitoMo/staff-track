import { BranchRepository } from '@/repository/branch-repository'
import { Branch, BranchUpdateInput, CreateBranchInput } from '@/types/branch'

export class BranchService {
    static async getAllBranches(): Promise<Branch[]> {
        return BranchRepository.getAllBranches()
    }

    static async createBranch(data: CreateBranchInput): Promise<Branch> {
        return BranchRepository.createBranch(data)
    }
    static async getBranchById(branchId: number): Promise<Branch | null> {
        return BranchRepository.getBranchById(branchId)
    }
    static async updateBranch(branchId: number, data: BranchUpdateInput): Promise<Branch> {
        return BranchRepository.updateBranch(branchId, data)
    }
}
