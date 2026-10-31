export const LOCALES = ["ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ar";

/** A UI preference like the branch cookie: read by the root layout, written by the language switcher. */
export const LOCALE_COOKIE = "locale";

export function isLocale(value: string | undefined): value is Locale {
    return LOCALES.some((locale) => locale === value);
}

export function dirOf(locale: Locale): "rtl" | "ltr" {
    return locale === "ar" ? "rtl" : "ltr";
}

/** The tag handed to Intl: Lebanese Arabic (أيلول, تشرين الأول) with Western digits (0-9), so times and counts scan the same in both languages. */
export function intlLocale(locale: Locale): string {
    return locale === "ar" ? "ar-LB-u-nu-latn" : "en-US";
}

/**
 * Wraps text typed into the app (a branch, person or task name) in Unicode first-strong isolates, so an
 * English name inside an Arabic sentence keeps its own direction and doesn't reorder the punctuation around it.
 */
export function isolate(text: string): string {
    return `⁨${text}⁩`;
}

/**
 * Picks the form for `count` by the locale's plural rules: Arabic has zero/one/two/few/many/other,
 * English just one/other. A missing form falls back to `other`.
 */
export function plural(locale: Locale, count: number, forms: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }): string {
    return (forms[new Intl.PluralRules(intlLocale(locale)).select(count)] ?? forms.other).replace("#", String(count));
}
