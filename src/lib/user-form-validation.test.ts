import { isUserFormValid, UserFormInput, validateUserForm } from '@/lib/user-form-validation';

function input(overrides: Partial<UserFormInput> = {}): UserFormInput {
    return {
        name: 'Alice Manager',
        phone: '555-0100',
        password: 'password123',
        roleId: 2,
        ...overrides,
    };
}

describe('validateUserForm', () => {
    it('accepts a fully valid create input', () => {
        const errors = validateUserForm(input(), { requirePassword: true });
        expect(isUserFormValid(errors)).toBe(true);
    });

    it('accepts a valid edit input with no password', () => {
        const errors = validateUserForm(input({ password: undefined }), { requirePassword: false });
        expect(isUserFormValid(errors)).toBe(true);
    });

    it.each([3, 50])('accepts a name at the boundary length (%d chars)', (length) => {
        const errors = validateUserForm(input({ name: 'a'.repeat(length) }), { requirePassword: true });
        expect(errors.name).toBeUndefined();
    });

    it('rejects a name shorter than 3 characters', () => {
        const errors = validateUserForm(input({ name: 'ab' }), { requirePassword: true });
        expect(errors.name).toBeDefined();
    });

    it('rejects a name longer than 50 characters', () => {
        const errors = validateUserForm(input({ name: 'a'.repeat(51) }), { requirePassword: true });
        expect(errors.name).toBeDefined();
    });

    it('rejects an empty phone', () => {
        const errors = validateUserForm(input({ phone: '' }), { requirePassword: true });
        expect(errors.phone).toBeDefined();
    });

    it('does not reject a phone for having no dashes or a non-standard format', () => {
        // The backend has no phone format constraint beyond non-empty — mirror that exactly.
        const errors = validateUserForm(input({ phone: 'not-a-phone-number-at-all' }), { requirePassword: true });
        expect(errors.phone).toBeUndefined();
    });

    it('requires a password when requirePassword is true', () => {
        const errors = validateUserForm(input({ password: undefined }), { requirePassword: true });
        expect(errors.password).toBeDefined();
    });

    it('rejects a password shorter than 8 characters', () => {
        const errors = validateUserForm(input({ password: 'short1' }), { requirePassword: true });
        expect(errors.password).toBeDefined();
    });

    it('rejects a password longer than 100 characters', () => {
        const errors = validateUserForm(input({ password: 'a'.repeat(101) }), { requirePassword: true });
        expect(errors.password).toBeDefined();
    });

    it('does not require a password when requirePassword is false, even if empty', () => {
        const errors = validateUserForm(input({ password: '' }), { requirePassword: false });
        expect(errors.password).toBeUndefined();
    });

    it('requires a role', () => {
        const errors = validateUserForm(input({ roleId: null }), { requirePassword: true });
        expect(errors.roleId).toBeDefined();
    });

    it('does not require any branch to be selected', () => {
        // No "at least one branch" rule — the owner role legitimately has zero branch links.
        // (Branches aren't part of UserFormInput at all; this documents the deliberate omission.)
        const errors = validateUserForm(input(), { requirePassword: true });
        expect(isUserFormValid(errors)).toBe(true);
    });
});
