import { cookies } from "next/headers";
import { dictionaries, type Dictionary } from "@/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "@/i18n/locales";

export async function getLocale(): Promise<Locale> {
    const value = (await cookies()).get(LOCALE_COOKIE)?.value;
    return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** The current request's dictionary, for Server Components (Client Components use `useT()`). */
export async function getDictionary(): Promise<Dictionary> {
    return dictionaries[await getLocale()];
}

/** The dictionary and the locale from one cookie read, for a Server Component that also formats dates. */
export async function getI18n(): Promise<{ t: Dictionary; locale: Locale }> {
    const locale = await getLocale();
    return { t: dictionaries[locale], locale };
}
