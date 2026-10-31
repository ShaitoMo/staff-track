"use client";

import { createContext, useContext } from "react";
import { dictionaries, type Dictionary } from "@/i18n/dictionaries";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locales";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** Only the locale crosses from the server layout: the dictionaries hold functions, so each side imports them itself. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
    return <LocaleContext value={locale}>{children}</LocaleContext>;
}

export function useLocale(): Locale {
    return useContext(LocaleContext);
}

export function useT(): Dictionary {
    return dictionaries[useLocale()];
}
