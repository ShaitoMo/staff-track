import { isPeriodFormValid, parseSortOrder, PeriodFormInput, validatePeriodForm } from '@/lib/period-form-validation';

const valid: PeriodFormInput = { branch: 1, name: 'Morning', defaultStart: '07:00', defaultEnd: '15:00', sortOrder: '' };

describe('validatePeriodForm', () => {
    it('accepts a branch period and a chain-wide one', () => {
        expect(isPeriodFormValid(validatePeriodForm(valid))).toBe(true);
        expect(isPeriodFormValid(validatePeriodForm({ ...valid, branch: 'chain-wide' }))).toBe(true);
    });

    it('requires a branch choice, even though chain-wide is allowed', () => {
        expect(validatePeriodForm({ ...valid, branch: null }).branch).toBeDefined();
    });

    it.each(['', '   ', 'a'.repeat(51)])('rejects the name %p', (name) => {
        expect(validatePeriodForm({ ...valid, name }).name).toBeDefined();
    });

    it('requires both times', () => {
        const errors = validatePeriodForm({ ...valid, defaultStart: '', defaultEnd: '' });
        expect(errors.defaultStart).toBeDefined();
        expect(errors.defaultEnd).toBeDefined();
    });

    it.each(['07:00', '06:00'])('rejects an end at or before the start (%s)', (defaultEnd) => {
        expect(validatePeriodForm({ ...valid, defaultEnd }).defaultEnd).toBeDefined();
    });

    it('rejects an order that is not a whole number', () => {
        expect(validatePeriodForm({ ...valid, sortOrder: '1.5' }).sortOrder).toBeDefined();
        expect(validatePeriodForm({ ...valid, sortOrder: 'first' }).sortOrder).toBeDefined();
    });
});

describe('parseSortOrder', () => {
    it('reads empty as 0 and keeps whole numbers', () => {
        expect(parseSortOrder('')).toBe(0);
        expect(parseSortOrder(' 3 ')).toBe(3);
        expect(parseSortOrder('-1')).toBe(-1);
        expect(parseSortOrder('2.5')).toBeNull();
    });
});
