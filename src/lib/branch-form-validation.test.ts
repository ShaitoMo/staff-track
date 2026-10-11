import { BranchFormInput, isBranchFormValid, validateBranchForm } from '@/lib/branch-form-validation';

function input(overrides: Partial<BranchFormInput> = {}): BranchFormInput {
    return { name: 'Main Branch', location: 'Beirut', ...overrides };
}

const noLocationYet = { hadLocation: false };

describe('validateBranchForm', () => {
    it('accepts a valid name and location', () => {
        expect(isBranchFormValid(validateBranchForm(input(), noLocationYet))).toBe(true);
    });

    it('accepts an empty location when none was set before', () => {
        expect(isBranchFormValid(validateBranchForm(input({ location: '' }), noLocationYet))).toBe(true);
    });

    it.each([3, 50])('accepts a name at the boundary length (%d chars)', (length) => {
        const errors = validateBranchForm(input({ name: 'a'.repeat(length) }), noLocationYet);
        expect(errors.name).toBeUndefined();
    });

    it.each([2, 51])('rejects a name of %d characters', (length) => {
        const errors = validateBranchForm(input({ name: 'a'.repeat(length) }), noLocationYet);
        expect(errors.name).toBeDefined();
    });

    it.each([3, 100])('accepts a location at the boundary length (%d chars)', (length) => {
        const errors = validateBranchForm(input({ location: 'a'.repeat(length) }), noLocationYet);
        expect(errors.location).toBeUndefined();
    });

    it.each([2, 101])('rejects a location of %d characters', (length) => {
        const errors = validateBranchForm(input({ location: 'a'.repeat(length) }), noLocationYet);
        expect(errors.location).toBeDefined();
    });

    it('rejects clearing a location that was already set', () => {
        const errors = validateBranchForm(input({ location: '' }), { hadLocation: true });
        expect(errors.location).toBeDefined();
    });
});
