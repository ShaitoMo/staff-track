jest.mock('@/lib/db', () => ({ db: {} }));
jest.mock('@/repository/section-type-repository', () => ({
    SectionTypeRepository: {
        nameTaken: jest.fn(),
        nextDisplayOrder: jest.fn(),
        createSectionType: jest.fn(),
        updateSectionType: jest.fn(),
    },
}));

import { SectionTypeService } from '@/services/section-type-service';
import { SectionTypeRepository } from '@/repository/section-type-repository';
import { DuplicateSectionTypeNameError } from '@/exceptions/duplicate-section-type-name-error';

const nameTaken = SectionTypeRepository.nameTaken as jest.Mock;
const nextDisplayOrder = SectionTypeRepository.nextDisplayOrder as jest.Mock;
const createSectionType = SectionTypeRepository.createSectionType as jest.Mock;
const updateSectionType = SectionTypeRepository.updateSectionType as jest.Mock;

beforeEach(() => {
    jest.resetAllMocks();
});

describe('SectionTypeService', () => {
    it('refuses a name already taken regardless of case, before inserting', async () => {
        nameTaken.mockResolvedValue(true);

        await expect(SectionTypeService.createSectionType({ name: 'dairy FRIDGE' })).rejects.toThrow(DuplicateSectionTypeNameError);
        expect(createSectionType).not.toHaveBeenCalled();
    });

    it('appends a new type to the end of the catalogue unless a position is given', async () => {
        nameTaken.mockResolvedValue(false);
        nextDisplayOrder.mockResolvedValue(6);

        await SectionTypeService.createSectionType({ name: 'Bakery' });
        await SectionTypeService.createSectionType({ name: 'Deli', displayOrder: 1 });

        expect(createSectionType.mock.calls).toEqual([[{ name: 'Bakery', displayOrder: 6 }], [{ name: 'Deli', displayOrder: 1 }]]);
    });

    it("checks a rename against every other type's name, not its own", async () => {
        nameTaken.mockResolvedValue(false);

        await SectionTypeService.updateSectionType(3, { name: 'Dairy Fridge' });

        expect(nameTaken).toHaveBeenCalledWith('Dairy Fridge', 3);
    });

    it('deactivates without touching anything else', async () => {
        await SectionTypeService.deactivateSectionType(3);

        expect(updateSectionType).toHaveBeenCalledWith(3, { isActive: false });
    });
});
