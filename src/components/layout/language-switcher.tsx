"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LanguagesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { dictionaries } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/client";
import { LOCALE_COOKIE, type Locale } from "@/i18n/locales";
import { TOUCH_HEIGHT } from "@/lib/touch";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Flips to the other language: writes the cookie the root layout reads, then re-renders on the
 * server so `lang`/`dir` and every string follow. The label names the target language in itself.
 */
export function useSwitchLanguage() {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const other: Locale = useLocale() === "ar" ? "en" : "ar";

    function switchLanguage() {
        document.cookie = `${LOCALE_COOKIE}=${other}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
        startTransition(() => router.refresh());
    }

    return { other, label: dictionaries[other].common.languageName, pending, switchLanguage };
}

/** The standalone button, for screens without the account menu (the login page). */
export function LanguageSwitcher() {
    const { other, label, pending, switchLanguage } = useSwitchLanguage();

    return (
        <Button variant="ghost" size="sm" lang={other} onClick={switchLanguage} disabled={pending} className={TOUCH_HEIGHT}>
            {pending ? <Spinner data-icon="inline-start" /> : <LanguagesIcon aria-hidden data-icon="inline-start" />}
            {label}
        </Button>
    );
}
