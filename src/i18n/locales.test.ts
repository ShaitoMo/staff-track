import { dictionaries } from '@/i18n/dictionaries';
import { dirOf, intlLocale, isLocale, isolate, plural } from '@/i18n/locales';
import { formatLatestPunch, formatMinutes } from '@/lib/attendance-rows';
import { formatDay, formatDayStacked, formatWeekRange } from '@/lib/coverage-rows';
import { describeRecurrence } from '@/lib/recurrence-label';

describe('locales', () => {
    it('accepts only the two supported locales', () => {
        expect(isLocale('ar')).toBe(true);
        expect(isLocale('en')).toBe(true);
        expect(isLocale('fr')).toBe(false);
        expect(isLocale(undefined)).toBe(false);
    });

    it('lays Arabic out right to left', () => {
        expect(dirOf('ar')).toBe('rtl');
        expect(dirOf('en')).toBe('ltr');
    });

    it('formats Arabic with Lebanese month names and Western digits', () => {
        expect(intlLocale('ar')).toBe('ar-LB-u-nu-latn');
        expect(intlLocale('en')).toBe('en-US');
    });

    it('wraps typed-in text in first-strong isolates', () => {
        expect(isolate('Hamra')).toBe('⁨Hamra⁩');
    });
});

describe('plural', () => {
    const forms = { one: 'one', two: 'two', few: '# few', many: '# many', other: '# other' };

    it('follows the Arabic plural categories', () => {
        expect(plural('ar', 1, forms)).toBe('one');
        expect(plural('ar', 2, forms)).toBe('two');
        expect(plural('ar', 5, forms)).toBe('5 few');
        expect(plural('ar', 11, forms)).toBe('11 many');
        expect(plural('ar', 100, forms)).toBe('100 other');
    });

    it('uses the Arabic zero form when one is given', () => {
        expect(plural('ar', 0, { zero: 'none', other: '# other' })).toBe('none');
    });

    it('falls back to other for a missing form', () => {
        expect(plural('ar', 0, { other: '# items' })).toBe('0 items');
        expect(plural('en', 3, { one: 'one', other: '# items' })).toBe('3 items');
    });
});

describe('Arabic dates and durations', () => {
    it('names the day and month in Arabic, with Western digits', () => {
        expect(formatDay('2026-09-28', 'ar')).toBe('الاثنين 28 أيلول');
        expect(formatWeekRange('2026-09-28', 'ar')).toBe('28 أيلول – 4 تشرين الأول');
    });

    it('splits the weekday from the day of the month in either language', () => {
        expect(formatDayStacked('2026-09-28', 'en')).toEqual({ weekday: 'Mon', day: '28' });
        expect(formatDayStacked('2026-09-28', 'ar')).toEqual({ weekday: 'الاثنين', day: '28' });
    });

    it('abbreviates hours and minutes in Arabic', () => {
        expect(formatMinutes(45, 'ar')).toBe('45 د');
        expect(formatMinutes(77, 'ar')).toBe('1 س 17 د');
    });

    it('dates the latest punch on the branch clock, with an Arabic comma', () => {
        expect(formatLatestPunch(new Date('2026-01-12T22:30:00.000Z'), 'ar')).toBe('الثلاثاء 13 كانون الثاني، 00:30');
    });

    it('describes a daily rule in Arabic', () => {
        expect(describeRecurrence('daily', dictionaries.ar.tasks.recurrence)).toBe('يوميًا');
    });

    it('describes a weekly rule with Arabic weekday names', () => {
        expect(describeRecurrence('weekly:mon,wed', dictionaries.ar.tasks.recurrence)).toBe('أسبوعيًا: الاثنين، الأربعاء');
    });
});
