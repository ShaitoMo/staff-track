import { db } from '@/lib/db'
import type { Register } from '@prisma/client'

export class RegisterRepository {
    static async getAllRegisters(): Promise<Register[]> {
        return db.register.findMany({
            select: {
                registerId: true,
                branchId: true,
                name: true,
            },
        })
    }
}

