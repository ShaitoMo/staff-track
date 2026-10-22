import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
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
    visibleToStaff: boolean // it and its section are active (an active folder's ancestors always are)
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
        return {
            view,
            branchId: section.branchId,
            sectionActive: section.isActive,
            parentActive: parent?.isActive ?? true,
            visibleToStaff: view.isActive && section.isActive,
        }
    }

    /**
     * A folder id taken from a request about one section must belong to it; with `visibleOnly`
     * (a staff caller) an inactive one is missing too, so its existence isn't confirmed.
     */
    static async getFolderInSection(branchSectionId: number, folderId: number, visibleOnly = false): Promise<GuideFolderRecord> {
        const folder = await GuideFolderRepository.getFolderById(folderId)

        if (!folder || folder.view.branchSectionId !== branchSectionId || (visibleOnly && !folder.visibleToStaff)) {
            throw new GuideFolderNotFoundError()
        }

        return folder
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

    /** The folder and its active descendants → inactive; photos in the subtree stay put, hidden with them. */
    static async deactivateFolder(folderId: number, now: Date): Promise<void> {
        await db.$transaction(async (tx) => {
            const ids = await GuideFolderRepository.subtreeIds(tx, folderId)
            await tx.guideFolder.updateMany({ where: { folderId: { in: ids }, isActive: true }, data: { isActive: false, updatedAt: now } })
        })
    }

    /** The folder and its inactive descendants come back, photos and all; ancestors and the section are left alone. */
    static async reactivateFolder(folderId: number, now: Date): Promise<ReactivationImpact> {
        return db.$transaction(async (tx) => {
            const ids = await GuideFolderRepository.subtreeIds(tx, folderId)
            const impact = await GuideFolderRepository.impactOf(tx, ids, false)

            await tx.guideFolder.updateMany({ where: { folderId: { in: ids }, isActive: false }, data: { isActive: true, updatedAt: now } })

            return impact
        })
    }

    static async deactivationImpact(folderId: number): Promise<DeactivationImpact> {
        return GuideFolderRepository.impactOf(db, await GuideFolderRepository.subtreeIds(db, folderId), true)
    }

    static async reactivationImpact(folderId: number): Promise<ReactivationImpact> {
        return GuideFolderRepository.impactOf(db, await GuideFolderRepository.subtreeIds(db, folderId), false)
    }

    /** Folders in `ids` that are `isActive` now (and will flip), and the photos inside them. */
    private static async impactOf(client: Prisma.TransactionClient, ids: number[], isActive: boolean): Promise<ReactivationImpact> {
        const where = { folderId: { in: ids }, isActive }
        const [folders, images] = await Promise.all([
            client.guideFolder.count({ where }),
            client.guideImage.count({ where: { folder: where } }),
        ])
        return { folders, images }
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
