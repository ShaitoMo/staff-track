import { isRoleFormValid, validateRoleForm } from '@/lib/role-form-validation';

describe('validateRoleForm', () => {
    it.each([3, 50])('accepts a name of %d characters', (length) => {
        expect(isRoleFormValid(validateRoleForm({ name: 'a'.repeat(length) }))).toBe(true);
    });

    it.each([0, 2, 51])('rejects a name of %d characters', (length) => {
        expect(validateRoleForm({ name: 'a'.repeat(length) }).name).toBeDefined();
    });

    it('validates the trimmed name, so padding cannot reach the minimum', () => {
        expect(validateRoleForm({ name: '  ab  ' }).name).toBeDefined();
        expect(isRoleFormValid(validateRoleForm({ name: '  abc  ' }))).toBe(true);
    });
});
