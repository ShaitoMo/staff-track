import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { CreateSectionTypeInput, SectionTypeView, UpdateSectionTypeInput } from '@/types/shelf-guide'
import { DuplicateSectionTypeNameError } from '@/exceptions/duplicate-section-type-name-error'
import { SectionTypeNotFoundError } from '@/exceptions/section-type-not-found-error'

const SECTION_TYPE_SELECT = {
    sectionTypeId: true,
    name: true,
    displayOrder: true,
    isActive: true,
} satisfies Prisma.SectionTypeSelect

export class SectionTypeRepository {
    static async getSectionTypes(includeInactive: boolean): Promise<SectionTypeView[]> {
        return db.sectionType.findMany({
            where: includeInactive ? {} : { isActive: true },
            orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
            select: SECTION_TYPE_SELECT,
        })
    }

    static async getSectionTypeById(sectionTypeId: number): Promise<SectionTypeView | null> {
        return db.sectionType.findUnique({ where: { sectionTypeId }, select: SECTION_TYPE_SELECT })
    }

    /** Case-insensitive, like the lower(name) index, so a duplicate is a 409 before the index throws. */
    static async nameTaken(name: string, exceptSectionTypeId?: number): Promise<boolean> {
        const match = await db.sectionType.findFirst({
            where: {
                name: { equals: name, mode: 'insensitive' },
                ...(exceptSectionTypeId !== undefined && { sectionTypeId: { not: exceptSectionTypeId } }),
            },
            select: { sectionTypeId: true },
        })
        return match !== null
    }

    static async nextDisplayOrder(): Promise<number> {
        const { _max } = await db.sectionType.aggregate({ _max: { displayOrder: true } })
        return (_max.displayOrder ?? -1) + 1
    }

    static async createSectionType(data: Required<CreateSectionTypeInput>): Promise<SectionTypeView> {
        try {
            return await db.sectionType.create({ data, select: SECTION_TYPE_SELECT })
        } catch (error: unknown) {
            throw SectionTypeRepository.mapError(error)
        }
    }

    static async updateSectionType(sectionTypeId: number, data: UpdateSectionTypeInput): Promise<SectionTypeView> {
        try {
            return await db.sectionType.update({ where: { sectionTypeId }, data, select: SECTION_TYPE_SELECT })
        } catch (error: unknown) {
            throw SectionTypeRepository.mapError(error)
        }
    }

    private static mapError(error: unknown): unknown {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2002') return new DuplicateSectionTypeNameError()
            if (error.code === 'P2025') return new SectionTypeNotFoundError()
        }
        return error
    }
}
