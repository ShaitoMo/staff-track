import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { GuideImageRepository } from '@/repository/guide-image-repository'
import { DeactivationImpact, GuideFolderView, ReactivationImpact, UpdateGuideFolderInput } from '@/types/shelf-guide'
import { GuideFolderNotFoundError } from '@/exceptions/guide-folder-not-found-error'

const FOLDER_SELECT = {
    folderId: true,
    branchSectionId: true,
    parentFolderId: true,
    name: true,
    displayOrder: true,
    isActive: true,
} satisfies Prisma.GuideFolderSelect

/** The view plus what access checks need: its section's branch and whether the section and parent are on. */
export interface GuideFolderRecord {
    view: GuideFolderView
    branchId: number
    sectionActive: boolean
    parentActive: boolean // true at the section root
}

export class GuideFolderRepository {
    static async getChildren(branchSectionId: number, parentFolderId: number | null, includeInactive: boolean): Promise<GuideFolderView[]> {
        return db.guideFolder.findMany({
            where: { branchSectionId, parentFolderId, ...(!includeInactive && { isActive: true }) },
            orderBy: [{ displayOrder: 'asc' }, { folderId: 'asc' }],
            select: FOLDER_SELECT,
        })
    }

    static async getFolderById(folderId: number): Promise<GuideFolderRecord | null> {
        const row = await db.guideFolder.findUnique({
            where: { folderId },
            select: {
                ...FOLDER_SELECT,
                section: { select: { branchId: true, isActive: true } },
                parent: { select: { isActive: true } },
            },
        })

        if (!row) {
            return null
        }

        const { section, parent, ...view } = row
        return { view, branchId: section.branchId, sectionActive: section.isActive, parentActive: parent?.isActive ?? true }
    }

    /** Appends to the end of its siblings. */
    static async createFolder(data: { branchSectionId: number; parentFolderId: number | null; name: string }): Promise<GuideFolderView> {
        return db.$transaction(async (tx) => {
            const { _max } = await tx.guideFolder.aggregate({
                where: { branchSectionId: data.branchSectionId, parentFolderId: data.parentFolderId },
                _max: { displayOrder: true },
            })
            return tx.guideFolder.create({
                data: { ...data, displayOrder: (_max.displayOrder ?? -1) + 1 },
                select: FOLDER_SELECT,
            })
        })
    }

    static async updateFolder(folderId: number, data: UpdateGuideFolderInput): Promise<GuideFolderView> {
        try {
            return await db.guideFolder.update({ where: { folderId }, data, select: FOLDER_SELECT })
        } catch (error: unknown) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw new GuideFolderNotFoundError()
            }
            throw error
        }
    }

    /** The folder and its active descendants → inactive; live photos anywhere in the subtree → recycle bin. */
    static async deactivateFolder(folderId: number, now: Date): Promise<void> {
        await db.$transaction(async (tx) => {
            const ids = await GuideFolderRepository.subtreeIds(tx, folderId)
            await tx.guideFolder.updateMany({ where: { folderId: { in: ids }, isActive: true }, data: { isActive: false, updatedAt: now } })
            await GuideImageRepository.recycleWhere(tx, { folderId: { in: ids } }, now)
        })
    }

    /** The folder and its inactive descendants come back; ancestors and the section are left alone. */
    static async reactivateFolder(folderId: number, branchSectionId: number, restoreImages: boolean, now: Date): Promise<ReactivationImpact> {
        return db.$transaction(async (tx) => {
            const ids = await GuideFolderRepository.subtreeIds(tx, folderId)
            const impact = await GuideFolderRepository.impactOf(tx, ids)

            await tx.guideFolder.updateMany({ where: { folderId: { in: ids }, isActive: false }, data: { isActive: true, updatedAt: now } })
            const images = restoreImages
                ? await GuideImageRepository.restoreWhere(tx, branchSectionId, { folderId: { in: ids } })
                : 0

            return { ...impact, images }
        })
    }

    static async deactivationImpact(folderId: number): Promise<DeactivationImpact> {
        const ids = await GuideFolderRepository.subtreeIds(db, folderId)
        const [folders, images] = await Promise.all([
            db.guideFolder.count({ where: { folderId: { in: ids }, isActive: true } }),
            GuideImageRepository.countLive(db, { folderId: { in: ids } }),
        ])
        return { folders, images }
    }

    static async reactivationImpact(folderId: number): Promise<ReactivationImpact> {
        return GuideFolderRepository.impactOf(db, await GuideFolderRepository.subtreeIds(db, folderId))
    }

    private static async impactOf(client: Prisma.TransactionClient, ids: number[]): Promise<ReactivationImpact> {
        const [folders, recycled] = await Promise.all([
            client.guideFolder.count({ where: { folderId: { in: ids }, isActive: false } }),
            GuideImageRepository.countRecycled(client, { folderId: { in: ids } }),
        ])
        return { folders, images: recycled.restorable, permanentlyLost: recycled.purged }
    }

    /** The folder itself and every folder below it, at any depth. */
    private static async subtreeIds(client: Prisma.TransactionClient, folderId: number): Promise<number[]> {
        const rows = await client.$queryRaw<{ folder_id: number }[]>`
            WITH RECURSIVE subtree AS (
                SELECT folder_id FROM guide_folders WHERE folder_id = ${folderId}
                UNION ALL
                SELECT child.folder_id FROM guide_folders child JOIN subtree ON child.parent_folder_id = subtree.folder_id
            )
            SELECT folder_id FROM subtree`
        return rows.map(row => row.folder_id)
    }
}
