import { SectionTypeRepository } from '@/repository/section-type-repository'
import { CreateSectionTypeInput, SectionTypeView, UpdateSectionTypeInput } from '@/types/shelf-guide'
import { DuplicateSectionTypeNameError } from '@/exceptions/duplicate-section-type-name-error'
import { SectionTypeNotFoundError } from '@/exceptions/section-type-not-found-error'

export class SectionTypeService {
    static async getSectionTypes(includeInactive: boolean): Promise<SectionTypeView[]> {
        return SectionTypeRepository.getSectionTypes(includeInactive)
    }

    static async getSectionType(sectionTypeId: number): Promise<SectionTypeView> {
        const sectionType = await SectionTypeRepository.getSectionTypeById(sectionTypeId)

        if (!sectionType) {
            throw new SectionTypeNotFoundError()
        }

        return sectionType
    }

    static async createSectionType(data: CreateSectionTypeInput): Promise<SectionTypeView> {
        if (await SectionTypeRepository.nameTaken(data.name)) {
            throw new DuplicateSectionTypeNameError()
        }

        return SectionTypeRepository.createSectionType({
            name: data.name,
            displayOrder: data.displayOrder ?? await SectionTypeRepository.nextDisplayOrder(),
        })
    }

    static async updateSectionType(sectionTypeId: number, data: UpdateSectionTypeInput): Promise<SectionTypeView> {
        if (data.name !== undefined && await SectionTypeRepository.nameTaken(data.name, sectionTypeId)) {
            throw new DuplicateSectionTypeNameError()
        }

        return SectionTypeRepository.updateSectionType(sectionTypeId, data)
    }

    /** Soft delete. Never cascades: sections already using the type keep working, and it can still be added to branches. */
    static async deactivateSectionType(sectionTypeId: number): Promise<void> {
        await SectionTypeRepository.updateSectionType(sectionTypeId, { isActive: false })
    }
}
