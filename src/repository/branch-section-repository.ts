import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { BranchSectionView, DeactivationImpact, ReactivationImpact } from '@/types/shelf-guide'
import { DuplicateBranchSectionError } from '@/exceptions/duplicate-branch-section-error'
import { BranchSectionNotFoundError } from '@/exceptions/branch-section-not-found-error'

const sectionInclude = {
    sectionType: { select: { name: true } },
    branch: { select: { name: true } },
} satisfies Prisma.BranchSectionInclude

type SectionRow = Prisma.BranchSectionGetPayload<{ include: typeof sectionInclude }>

export class BranchSectionRepository {
    static async getSectionsByBranch(branchId: number, includeInactive: boolean): Promise<BranchSectionView[]> {
        const rows = await db.branchSection.findMany({
            where: { branchId, ...(!includeInactive && { isActive: true }) },
            orderBy: [{ displayOrder: 'asc' }, { branchSectionId: 'asc' }],
            include: sectionInclude,
        })
        return rows.map(BranchSectionRepository.toView)
    }

    static async getSectionById(branchSectionId: number): Promise<BranchSectionView | null> {
        const row = await db.branchSection.findUnique({ where: { branchSectionId }, include: sectionInclude })
        return row && BranchSectionRepository.toView(row)
    }

    /** Appends to the end of the branch's sections unless a position is given. */
    static async createSection(data: { branchId: number; sectionTypeId: number; displayOrder?: number }): Promise<BranchSectionView> {
        try {
            return await db.$transaction(async (tx) => {
                const displayOrder = data.displayOrder ?? await BranchSectionRepository.nextPosition(tx, data.branchId)
                const row = await tx.branchSection.create({ data: { ...data, displayOrder }, include: sectionInclude })
                return BranchSectionRepository.toView(row)
            })
        } catch (error: unknown) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new DuplicateBranchSectionError()
            }
            throw error
        }
    }

    static async updateSection(branchSectionId: number, data: { displayOrder: number }): Promise<BranchSectionView> {
        try {
            const row = await db.branchSection.update({ where: { branchSectionId }, data, include: sectionInclude })
            return BranchSectionRepository.toView(row)
        } catch (error: unknown) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw new BranchSectionNotFoundError()
            }
            throw error
        }
    }

    /** Section → inactive, its active folders (any depth) → inactive; photos stay put, hidden with them. One timestamp for all. */
    static async deactivateSection(branchSectionId: number, now: Date): Promise<void> {
        await db.$transaction(async (tx) => {
            await tx.branchSection.updateMany({ where: { branchSectionId, isActive: true }, data: { isActive: false, updatedAt: now } })
            await tx.guideFolder.updateMany({ where: { branchSectionId, isActive: true }, data: { isActive: false, updatedAt: now } })
        })
    }

    /** Section and all its folders come back, and with them every photo in it. */
    static async reactivateSection(branchSectionId: number, now: Date): Promise<ReactivationImpact> {
        return db.$transaction(async (tx) => {
            const impact = await BranchSectionRepository.reactivationImpact(branchSectionId, tx)

            await tx.branchSection.update({ where: { branchSectionId }, data: { isActive: true, updatedAt: now } })
            await tx.guideFolder.updateMany({ where: { branchSectionId, isActive: false }, data: { isActive: true, updatedAt: now } })

            return impact
        })
    }

    /** Photos staff can see now: at the root, or in a folder that is still active. */
    static async deactivationImpact(branchSectionId: number): Promise<DeactivationImpact> {
        const [folders, images] = await Promise.all([
            db.guideFolder.count({ where: { branchSectionId, isActive: true } }),
            db.guideImage.count({ where: { branchSectionId, OR: [{ folderId: null }, { folder: { isActive: true } }] } }),
        ])
        return { folders, images }
    }

    /** Every folder of an inactive section is inactive too, so all its photos come back. */
    static async reactivationImpact(branchSectionId: number, client: Prisma.TransactionClient = db): Promise<ReactivationImpact> {
        const [folders, images] = await Promise.all([
            client.guideFolder.count({ where: { branchSectionId, isActive: false } }),
            client.guideImage.count({ where: { branchSectionId } }),
        ])
        return { folders, images }
    }

    private static async nextPosition(tx: Prisma.TransactionClient, branchId: number): Promise<number> {
        const { _max } = await tx.branchSection.aggregate({ where: { branchId }, _max: { displayOrder: true } })
        return (_max.displayOrder ?? -1) + 1
    }

    private static toView(row: SectionRow): BranchSectionView {
        return {
            branchSectionId: row.branchSectionId,
            branchId: row.branchId,
            branchName: row.branch.name,
            sectionTypeId: row.sectionTypeId,
            name: row.sectionType.name,
            displayOrder: row.displayOrder,
            isActive: row.isActive,
        }
    }
}
