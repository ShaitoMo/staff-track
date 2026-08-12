import { getDates, addDays, toUtcDate, isValidRecurrence, WINDOW_DAYS } from '@/lib/recurrence';
import { InvalidRecurrenceError } from '@/exceptions/invalid-recurrence-error';

/** UTC midnight for a 'YYYY-MM-DD' string, matching how Postgres `date` values arrive. */
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Renders results as 'YYYY-MM-DD' so failures are readable. */
const iso = (dates: Date[]) => dates.map((date) => date.toISOString().slice(0, 10));

describe('getDates - daily', () => {
    it('returns every date in an inclusive range', () => {
        expect(iso(getDates('daily', d('2026-08-12'), d('2026-08-15')))).toEqual([
            '2026-08-12',
            '2026-08-13',
            '2026-08-14',
            '2026-08-15',
        ]);
    });

    it('returns a single date when from and to are the same day', () => {
        expect(iso(getDates('daily', d('2026-08-12'), d('2026-08-12')))).toEqual(['2026-08-12']);
    });

    it('spans month and year boundaries', () => {
        expect(iso(getDates('daily', d('2026-12-30'), d('2027-01-02')))).toEqual([
            '2026-12-30',
            '2026-12-31',
            '2027-01-01',
            '2027-01-02',
        ]);
    });

    it('includes the leap day when the range covers it', () => {
        expect(iso(getDates('daily', d('2028-02-27'), d('2028-03-01')))).toEqual([
            '2028-02-27',
            '2028-02-28',
            '2028-02-29',
            '2028-03-01',
        ]);
    });

    it('returns an empty array for an inverted range', () => {
        expect(getDates('daily', d('2026-08-15'), d('2026-08-12'))).toEqual([]);
    });

    it('produces WINDOW_DAYS + 1 dates for the generation window', () => {
        const today = d('2026-08-12');
        const dates = getDates('daily', today, addDays(today, WINDOW_DAYS));

        expect(dates).toHaveLength(WINDOW_DAYS + 1);
        expect(iso(dates)[0]).toBe('2026-08-12');
        expect(iso(dates)[dates.length - 1]).toBe('2026-08-26');
    });
});

describe('getDates - weekly', () => {
    // 2026-08-12 is a Wednesday.
    it('returns only the listed weekdays', () => {
        expect(iso(getDates('weekly:mon,wed', d('2026-08-10'), d('2026-08-23')))).toEqual([
            '2026-08-10', // Mon
            '2026-08-12', // Wed
            '2026-08-17', // Mon
            '2026-08-19', // Wed
        ]);
    });

    it('handles a single weekday', () => {
        expect(iso(getDates('weekly:sun', d('2026-08-10'), d('2026-08-23')))).toEqual([
            '2026-08-16',
            '2026-08-23',
        ]);
    });

    it('includes both endpoints when they fall on listed weekdays', () => {
        expect(iso(getDates('weekly:mon,fri', d('2026-08-10'), d('2026-08-14')))).toEqual([
            '2026-08-10', // Mon, the `from` bound
            '2026-08-14', // Fri, the `to` bound
        ]);
    });

    it('returns an empty array when no listed weekday falls in the range', () => {
        // 2026-08-11 is Tue, 2026-08-13 is Thu - neither is a Monday.
        expect(getDates('weekly:mon', d('2026-08-11'), d('2026-08-13'))).toEqual([]);
    });

    it('accepts every weekday name', () => {
        const dates = getDates('weekly:sun,mon,tue,wed,thu,fri,sat', d('2026-08-10'), d('2026-08-16'));
        expect(dates).toHaveLength(7);
    });

    it('ignores surrounding whitespace and casing', () => {
        expect(iso(getDates('  WEEKLY:Mon , Wed  ', d('2026-08-10'), d('2026-08-13')))).toEqual([
            '2026-08-10',
            '2026-08-12',
        ]);
    });

    it('deduplicates a repeated weekday', () => {
        expect(iso(getDates('weekly:mon,mon', d('2026-08-10'), d('2026-08-16')))).toEqual(['2026-08-10']);
    });
});

describe('getDates - rejected rules', () => {
    it.each([
        ['monthly'],
        ['weekly'],
        ['weekly:'],
        ['weekly:funday'],
        ['weekly:mon,funday'],
        ['weekly:mon,'],
        ['daily:mon'],
        [''],
        ['  '],
        ['0 9 * * *'],
    ])('throws on %p', (rule) => {
        expect(() => getDates(rule, d('2026-08-10'), d('2026-08-20'))).toThrow(InvalidRecurrenceError);
    });

    it('throws on an invalid date bound', () => {
        expect(() => getDates('daily', new Date('not-a-date'), d('2026-08-20'))).toThrow(
            InvalidRecurrenceError,
        );
    });
});

describe('getDates - purity', () => {
    it('does not mutate its arguments', () => {
        const from = d('2026-08-12');
        const to = d('2026-08-15');

        getDates('daily', from, to);

        expect(from.toISOString()).toBe('2026-08-12T00:00:00.000Z');
        expect(to.toISOString()).toBe('2026-08-15T00:00:00.000Z');
    });

    it('normalizes bounds carrying a time component to whole days', () => {
        const from = new Date('2026-08-12T23:45:00.000Z');
        const to = new Date('2026-08-14T01:15:00.000Z');

        expect(iso(getDates('daily', from, to))).toEqual(['2026-08-12', '2026-08-13', '2026-08-14']);
    });

    it('returns UTC-midnight dates so they land on the intended `date` column value', () => {
        for (const date of getDates('daily', d('2026-08-12'), d('2026-08-14'))) {
            expect(date.toISOString()).toMatch(/T00:00:00\.000Z$/);
        }
    });
});

describe('isValidRecurrence', () => {
    it.each([['daily'], ['weekly:mon'], ['weekly:mon,wed,fri']])('accepts %p', (rule) => {
        expect(isValidRecurrence(rule)).toBe(true);
    });

    it.each([['monthly'], ['weekly:'], ['weekly:funday'], ['']])('rejects %p', (rule) => {
        expect(isValidRecurrence(rule)).toBe(false);
    });
});

describe('date helpers', () => {
    it('addDays crosses a month boundary', () => {
        expect(addDays(d('2026-08-31'), 1).toISOString().slice(0, 10)).toBe('2026-09-01');
    });

    it('addDays accepts negative offsets', () => {
        expect(addDays(d('2026-09-01'), -1).toISOString().slice(0, 10)).toBe('2026-08-31');
    });

    it('toUtcDate strips the time component', () => {
        expect(toUtcDate(new Date('2026-08-12T18:30:00.000Z')).toISOString()).toBe(
            '2026-08-12T00:00:00.000Z',
        );
    });
});
