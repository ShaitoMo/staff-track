import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { GuideLevel, isSameIdSet } from '@/lib/guide-order'
import { GuideImageView } from '@/types/shelf-guide'
import { GuidePhotoKeyInUseError } from '@/exceptions/guide-photo-key-in-use-error'
import { InvalidGuideOrderError } from '@/exceptions/invalid-guide-order-error'

const imageInclude = {
    section: { select: { branchId: true, isActive: true } },
    folder: { select: { isActive: true } },
} satisfies Prisma.GuideImageInclude

type ImageRow = Prisma.GuideImageGetPayload<{ include: typeof imageInclude }>

/** What routes need beyond the view: the branch to scope access by, the keys to serve, and whether staff may see it. */
export interface GuideImageRecord {
    view: GuideImageView // the only part a response may carry
    branchId: number
    storageKey: string
    thumbKey: string
    visibleToStaff: boolean // in an active section, and in an active folder (or at the root)
}

export class GuideImageRepository {
    static async getLevel(branchSectionId: number, folderId: GuideLevel): Promise<GuideImageRecord[]> {
        const rows = await db.guideImage.findMany({
            where: { branchSectionId, folderId },
            orderBy: [{ displayOrder: 'asc' }, { imageId: 'asc' }],
            include: imageInclude,
        })
        return rows.map(GuideImageRepository.toRecord)
    }

    static async getImageById(imageId: number): Promise<GuideImageRecord | null> {
        const row = await db.guideImage.findUnique({ where: { imageId }, include: imageInclude })
        return row && GuideImageRepository.toRecord(row)
    }

    /**
     * Appends to the end of its level. Under READ COMMITTED two uploads at the same moment can read
     * the same max and share a position; nothing breaks — imageId orders them — and the next
     * reorder renumbers the level.
     */
    static async createImage(data: {
        branchSectionId: number
        folderId: GuideLevel
        title: string | null
        storageKey: string
        thumbKey: string
        uploadedBy: number
    }): Promise<GuideImageRecord> {
        try {
            return await db.$transaction(async (tx) => {
                const displayOrder = await GuideImageRepository.nextPosition(tx, data.branchSectionId, data.folderId)
                const row = await tx.guideImage.create({ data: { ...data, displayOrder }, include: imageInclude })
                return GuideImageRepository.toRecord(row)
            })
        } catch (error: unknown) {
            throw GuideImageRepository.mapKeyInUse(error)
        }
    }

    static async updateImage(
        imageId: number,
        data: { title?: string | null; files?: { storageKey: string; thumbKey: string } },
    ): Promise<GuideImageRecord> {
        try {
            const row = await db.guideImage.update({
                where: { imageId },
                data: {
                    title: data.title,
                    ...(data.files && { ...data.files, version: { increment: 1 } }),
                },
                include: imageInclude,
            })
            return GuideImageRepository.toRecord(row)
        } catch (error: unknown) {
            throw GuideImageRepository.mapKeyInUse(error)
        }
    }

    /** Removes the row for good. Returns its file keys, or null when it was already gone. */
    static async deleteImage(imageId: number): Promise<{ storageKey: string; thumbKey: string } | null> {
        try {
            return await db.guideImage.delete({ where: { imageId }, select: { storageKey: true, thumbKey: true } })
        } catch (error: unknown) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                return null
            }
            throw error
        }
    }

    /** One transaction: the request must name exactly the photos at the level, else nothing moves. */
    static async reorderLevel(branchSectionId: number, folderId: GuideLevel, imageIds: number[]): Promise<void> {
        await db.$transaction(async (tx) => {
            const current = await tx.guideImage.findMany({
                where: { branchSectionId, folderId },
                select: { imageId: true },
            })

            if (!isSameIdSet(imageIds, current.map(image => image.imageId))) {
                throw new InvalidGuideOrderError()
            }

            for (const [displayOrder, imageId] of imageIds.entries()) {
                await tx.guideImage.update({ where: { imageId }, data: { displayOrder } })
            }
        })
    }

    private static async nextPosition(tx: Prisma.TransactionClient, branchSectionId: number, folderId: GuideLevel): Promise<number> {
        const { _max } = await tx.guideImage.aggregate({
            where: { branchSectionId, folderId },
            _max: { displayOrder: true },
        })
        return (_max.displayOrder ?? -1) + 1
    }

    /** Both keys are unique: a reused upload (a retry, a double submit) already belongs to another photo. */
    private static mapKeyInUse(error: unknown): unknown {
        return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
            ? new GuidePhotoKeyInUseError()
            : error
    }

    private static toRecord(row: ImageRow): GuideImageRecord {
        const files = `/api/guide-images/${row.imageId}`
        return {
            view: {
                imageId: row.imageId,
                branchSectionId: row.branchSectionId,
                folderId: row.folderId,
                title: row.title,
                displayOrder: row.displayOrder,
                version: row.version,
                fileUrl: `${files}/file?v=${row.version}`,
                thumbUrl: `${files}/thumb?v=${row.version}`,
            },
            branchId: row.section.branchId,
            storageKey: row.storageKey,
            thumbKey: row.thumbKey,
            visibleToStaff: row.section.isActive && (row.folder?.isActive ?? true),
        }
    }
}
