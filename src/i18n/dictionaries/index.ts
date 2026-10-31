import type { Locale } from "@/i18n/locales";
import { ar } from "./ar";
import { en, type Dictionary } from "./en";

export type { Dictionary };

export const dictionaries: Record<Locale, Dictionary> = { ar, en };
