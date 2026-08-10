import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { Branch, CreateBranchInput } from "@/types/branch";
import { BranchNotFoundError } from "@/exceptions/branch-not-found-error";
export class BranchRepository {
    static async getAllBranches(): Promise<Branch[]> {
        const branches = await db.branch.findMany({
            select: {  
                branchId: true,
                name: true,
                location: true,
            },
        })
        
        return branches.map(b => ({
            branchId: b.branchId,
            name: b.name,
            location: b.location ?? undefined,
        }))
    }
    static async getBranchesByUser(userId: number): Promise<Branch[]> {
        const branches = await db.branch.findMany({
            where: {
                userBranches: { some: { userId } },
            },
            select: {
                branchId: true,
                name: true,
                location: true,
            },
        })

        return branches.map(b => ({
            branchId: b.branchId,
            name: b.name,
            location: b.location ?? undefined,
        }))
    }
    static async createBranch(data: CreateBranchInput): Promise<Branch> {
        const branch = await db.branch.create({
            data: {
                name: data.name,
                location: data.location,
            },
            select: {
                branchId: true,
                name: true,
                location: true,
            },
        })

        return {
            branchId: branch.branchId,
            name: branch.name,
            location: branch.location ?? undefined,
        }
    }
    static async getBranchById(branchId: number): Promise<Branch | null> {
        const branch = await db.branch.findUnique({
            where: {
                branchId: branchId,
            },
            select: {
                branchId: true,
                name: true,
                location: true,
            },
        })

        if (!branch) {
            return null
        }

        return {
            branchId: branch.branchId,
            name: branch.name,
            location: branch.location ?? undefined,
        }
    }
    static async updateBranch(branchId: number, data: CreateBranchInput): Promise<Branch> {
        try {
            const branch = await db.branch.update({
                where: {
                    branchId: branchId,
                },
                data: {
                    name: data.name,
                    location: data.location ?? null,
                },
                select: {
                    branchId: true,
                    name: true,
                    location: true,
                },
            })

            return {
                branchId: branch.branchId,
                name: branch.name,
                location: branch.location ?? undefined,
            }
        } catch (error: unknown) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025'
            ) {
                throw new BranchNotFoundError()
            }
            throw error
        }
    }
}