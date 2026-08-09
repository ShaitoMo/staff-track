import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { CreateRegisterInput, Register, UpdateRegisterInput } from '@/types/register'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { RegisterNotFoundError } from '@/exceptions/register-not-found-error'

export class RegisterRepository {
    static async getRegistersByBranch(branchId: number): Promise<Register[]> {
        return db.register.findMany({
            where: { branchId },
            select: {
                registerId: true,
                branchId: true,
                name: true,
            },
        })
    }
    static async createRegister(data: CreateRegisterInput): Promise<Register> {
        try {
            return await db.register.create({
                data: {
                    branchId: data.branchId,
                    name: data.name,
                },
                select: {
                    registerId: true,
                    branchId: true,
                    name: true,
                },
            })
        } catch (error: unknown) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2003'
            ) {
                throw new BranchNotFoundError()
            }
            throw error
        }
    }
    static async getRegisterById(registerId: number): Promise<Register | null> {
        return db.register.findUnique({
            where: {
                registerId: registerId,
            },
            select: {
                registerId: true,
                branchId: true,
                name: true,
            },
        })
    }
    static async updateRegister(registerId: number, data: UpdateRegisterInput): Promise<Register> {
        try {
            return await db.register.update({
                where: {
                    registerId: registerId,
                },
                data: {
                    name: data.name,
                },
                select: {
                    registerId: true,
                    branchId: true,
                    name: true,
                },
            })
        } catch (error: unknown) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025'
            ) {
                throw new RegisterNotFoundError()
            }
            throw error
        }
    }
}
