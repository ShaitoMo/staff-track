import { describeRecurrence } from '@/lib/recurrence-label';

describe('describeRecurrence', () => {
    it('calls a task with no rule a one-off', () => {
        expect(describeRecurrence(null)).toBe('One-off');
    });

    it('labels a daily rule', () => {
        expect(describeRecurrence('daily')).toBe('Daily');
    });

    it('spells out the weekdays of a weekly rule', () => {
        expect(describeRecurrence('weekly:mon,wed')).toBe('Weekly: Mon, Wed');
    });

    it('falls back to the raw rule when it is not one it knows', () => {
        expect(describeRecurrence('monthly')).toBe('monthly');
    });
});
