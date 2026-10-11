import { CreateShiftSchema, UpdateShiftSchema } from '@/types/shift';

const accepts = (result: { success: boolean }) => result.success;

describe('CreateShiftSchema — end_time must be after start_time', () => {
    const base = {
        user_id: 1,
        branch_id: 2,
        shift_date: '2026-08-13',
        created_by: 3,
    };

    it('accepts a normal span', () => {
        expect(
            accepts(CreateShiftSchema.safeParse({ ...base, start_time: '09:00', end_time: '17:00' })),
        ).toBe(true);
    });

    it('rejects an end_time equal to start_time', () => {
        expect(
            accepts(CreateShiftSchema.safeParse({ ...base, start_time: '09:00', end_time: '09:00' })),
        ).toBe(false);
    });

    it('rejects an end_time before start_time', () => {
        const result = CreateShiftSchema.safeParse({ ...base, start_time: '17:00', end_time: '09:00' });

        expect(accepts(result)).toBe(false);
        expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain('end_time');
    });

    it('does not blame end_time for a start_time that failed its own format check', () => {
        const result = CreateShiftSchema.safeParse({ ...base, start_time: 'noon', end_time: '17:00' });

        expect(accepts(result)).toBe(false);
        expect(result.error?.issues.map((issue) => issue.path.join('.'))).not.toContain('end_time');
    });
});

describe('UpdateShiftSchema — start_time and end_time must be sent together', () => {
    it('accepts a patch that mentions neither', () => {
        expect(accepts(UpdateShiftSchema.safeParse({ user_id: 5 }))).toBe(true);
    });

    it('rejects start_time sent alone', () => {
        expect(accepts(UpdateShiftSchema.safeParse({ start_time: '09:00' }))).toBe(false);
    });

    it('rejects end_time sent alone', () => {
        expect(accepts(UpdateShiftSchema.safeParse({ end_time: '17:00' }))).toBe(false);
    });

    it('accepts a widened span sent as a pair', () => {
        expect(
            accepts(UpdateShiftSchema.safeParse({ start_time: '08:00', end_time: '18:00' })),
        ).toBe(true);
    });

    it('rejects a backwards span even when sent as a pair', () => {
        const result = UpdateShiftSchema.safeParse({ start_time: '17:00', end_time: '09:00' });

        expect(accepts(result)).toBe(false);
        expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain('end_time');
    });
});
