import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { GuideImageRepository } from '@/repository/guide-image-repository'
import { BranchSectionView, DeactivationImpact, ReactivationImpact } from '@/types/shelf-guide'
import { DuplicateBranchSectionError } from '@/exceptions/duplicate-branch-section-error'
import { BranchSectionNotFoundError } from '@/exceptions/branch-section-not-found-error'

const sectionInclude = {
    sectionType: { select: { name: true } },
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

    /** Section → inactive, its active folders (any depth) → inactive, its live photos → recycle bin. One timestamp for all. */
    static async deactivateSection(branchSectionId: number, now: Date): Promise<void> {
        await db.$transaction(async (tx) => {
            await tx.branchSection.updateMany({ where: { branchSectionId, isActive: true }, data: { isActive: false, updatedAt: now } })
            await tx.guideFolder.updateMany({ where: { branchSectionId, isActive: true }, data: { isActive: false, updatedAt: now } })
            await GuideImageRepository.recycleWhere(tx, { branchSectionId }, now)
        })
    }

    /** Section and all its folders come back; its recycled photos too when `restoreImages`. */
    static async reactivateSection(branchSectionId: number, restoreImages: boolean, now: Date): Promise<ReactivationImpact> {
        return db.$transaction(async (tx) => {
            const impact = await BranchSectionRepository.reactivationImpact(branchSectionId, tx)

            await tx.branchSection.update({ where: { branchSectionId }, data: { isActive: true, updatedAt: now } })
            await tx.guideFolder.updateMany({ where: { branchSectionId, isActive: false }, data: { isActive: true, updatedAt: now } })
            const images = restoreImages ? await GuideImageRepository.restoreWhere(tx, branchSectionId, {}) : 0

            return { ...impact, images }
        })
    }

    static async deactivationImpact(branchSectionId: number): Promise<DeactivationImpact> {
        const [folders, images] = await Promise.all([
            db.guideFolder.count({ where: { branchSectionId, isActive: true } }),
            GuideImageRepository.countLive(db, { branchSectionId }),
        ])
        return { folders, images }
    }

    static async reactivationImpact(branchSectionId: number, client: Prisma.TransactionClient = db): Promise<ReactivationImpact> {
        const [folders, recycled] = await Promise.all([
            client.guideFolder.count({ where: { branchSectionId, isActive: false } }),
            GuideImageRepository.countRecycled(client, { branchSectionId }),
        ])
        return { folders, images: recycled.restorable, permanentlyLost: recycled.purged }
    }

    private static async nextPosition(tx: Prisma.TransactionClient, branchId: number): Promise<number> {
        const { _max } = await tx.branchSection.aggregate({ where: { branchId }, _max: { displayOrder: true } })
        return (_max.displayOrder ?? -1) + 1
    }

    private static toView(row: SectionRow): BranchSectionView {
        return {
            branchSectionId: row.branchSectionId,
            branchId: row.branchId,
            sectionTypeId: row.sectionTypeId,
            name: row.sectionType.name,
            displayOrder: row.displayOrder,
            isActive: row.isActive,
        }
    }
}
