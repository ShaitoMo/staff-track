import { BranchRepository } from '@/repository/branch-repository'
import { RegisterRepository } from '@/repository/register-repository'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { RegisterNotFoundError } from '@/exceptions/register-not-found-error'
import { CreateRegisterInput, Register, UpdateRegisterInput } from '@/types/register'

export class RegisterService {
    static async getRegistersByBranch(branchId: number): Promise<Register[]> {
        await RegisterService.assertBranchExists(branchId)
        return RegisterRepository.getRegistersByBranch(branchId)
    }

    static async createRegister(data: CreateRegisterInput): Promise<Register> {
        return RegisterRepository.createRegister(data)
    }

    static async getRegisterById(registerId: number): Promise<Register> {
        const register = await RegisterRepository.getRegisterById(registerId)

        if (!register) {
            throw new RegisterNotFoundError()
        }

        return register
    }

    static async updateRegister(registerId: number, data: UpdateRegisterInput): Promise<Register> {
        return RegisterRepository.updateRegister(registerId, data)
    }

    private static async assertBranchExists(branchId: number): Promise<void> {
        const branch = await BranchRepository.getBranchById(branchId)

        if (!branch) {
            throw new BranchNotFoundError()
        }
    }
}
