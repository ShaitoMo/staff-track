import { isRegisterFormValid, validateRegisterForm } from '@/lib/register-form-validation';

describe('validateRegisterForm', () => {
    it('accepts a branch and a name', () => {
        expect(isRegisterFormValid(validateRegisterForm({ branchId: 1, name: 'Register 1' }))).toBe(true);
    });

    it('requires a branch', () => {
        const errors = validateRegisterForm({ branchId: null, name: 'Register 1' });
        expect(errors.branchId).toBeDefined();
    });

    it('rejects an empty name', () => {
        const errors = validateRegisterForm({ branchId: 1, name: '' });
        expect(errors.name).toBeDefined();
    });

    it('rejects a whitespace-only name (the schema trims it)', () => {
        const errors = validateRegisterForm({ branchId: 1, name: '   ' });
        expect(errors.name).toBeDefined();
    });

    it.each([1, 50])('accepts a name of %d characters', (length) => {
        const errors = validateRegisterForm({ branchId: 1, name: 'a'.repeat(length) });
        expect(errors.name).toBeUndefined();
    });

    it('rejects a name longer than 50 characters', () => {
        const errors = validateRegisterForm({ branchId: 1, name: 'a'.repeat(51) });
        expect(errors.name).toBeDefined();
    });
});
