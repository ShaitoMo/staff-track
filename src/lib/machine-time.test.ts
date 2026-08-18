import { machineDayOf } from '@/lib/machine-time';

/** UTC midnight, the anchor Postgres `date` columns arrive at. */
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/**
 * Beirut is +02:00 in winter and +03:00 in summer, switching at midnight local on the last Sunday
 * of March and of October. Cases sit on both sides of that, because a helper that hardcodes one
 * offset passes half of them.
 */
describe('machineDayOf', () => {
    it('returns the calendar day as UTC midnight', () => {
        expect(machineDayOf(new Date('2026-07-01T09:00:00Z'))).toEqual(day('2026-07-01'));
    });

    it('keeps midday on the day it belongs to, in winter', () => {
        expect(machineDayOf(new Date('2026-01-15T09:00:00Z'))).toEqual(day('2026-01-15'));
    });

    // The bug this exists for: 01:00 in Beirut on the 2nd is still 22:00 UTC on the 1st, so the
    // UTC calendar day answers 'yesterday' for the first hours of every business day.
    it('is already tomorrow when Beirut is, in summer', () => {
        expect(machineDayOf(new Date('2026-07-01T22:00:00Z'))).toEqual(day('2026-07-02'));
    });

    it('is already tomorrow when Beirut is, in winter', () => {
        expect(machineDayOf(new Date('2026-01-01T22:30:00Z'))).toEqual(day('2026-01-02'));
    });

    it('holds the previous day right up to Beirut midnight', () => {
        expect(machineDayOf(new Date('2026-07-01T20:59:59Z'))).toEqual(day('2026-07-01'));
    });

    it('turns over exactly at Beirut midnight', () => {
        expect(machineDayOf(new Date('2026-07-01T21:00:00Z'))).toEqual(day('2026-07-02'));
    });

    it('crosses the year on Beirut time, not UTC', () => {
        expect(machineDayOf(new Date('2026-12-31T22:30:00Z'))).toEqual(day('2027-01-01'));
    });

    // The clocks move at midnight local here, so the switch lands on the day boundary itself.
    it('is correct across the night DST ends', () => {
        expect(machineDayOf(new Date('2026-10-24T20:30:00Z'))).toEqual(day('2026-10-24'));
        expect(machineDayOf(new Date('2026-10-24T21:30:00Z'))).toEqual(day('2026-10-24'));
        expect(machineDayOf(new Date('2026-10-24T22:30:00Z'))).toEqual(day('2026-10-25'));
    });

    it('is correct across the night DST begins', () => {
        expect(machineDayOf(new Date('2026-03-28T21:30:00Z'))).toEqual(day('2026-03-28'));
        expect(machineDayOf(new Date('2026-03-28T22:30:00Z'))).toEqual(day('2026-03-29'));
    });

    it('ignores milliseconds', () => {
        expect(machineDayOf(new Date('2026-07-01T22:00:00.999Z'))).toEqual(day('2026-07-02'));
    });
});
