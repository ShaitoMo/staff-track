import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getDictionary } from "@/i18n/server";
import { TOUCH_HEIGHT } from "@/lib/touch";
import { cn } from "@/lib/utils";

/** `?page=` link that keeps the page's other params (`query`, e.g. branch); page 1 drops the param. */
export function pageHref(basePath: string, query: Record<string, string>, page: number): string {
    const params = new URLSearchParams(page === 1 ? query : { ...query, page: String(page) });
    const search = params.toString();
    return search === "" ? basePath : `${basePath}?${search}`;
}

/**
 * Previous · Page X of Y · Next under a paged list. Nothing renders for a list that fits on one page.
 * An ends-of-the-list button is left out rather than disabled, since a disabled link isn't a thing.
 */
export async function PageNav({
    basePath,
    query,
    page,
    pages,
}: {
    basePath: string;
    query: Record<string, string>;
    page: number;
    pages: number;
}) {
    const t = await getDictionary();

    if (pages <= 1) {
        return null;
    }

    const linkClass = cn(buttonVariants({ variant: "outline", size: "sm" }), TOUCH_HEIGHT);

    return (
        <nav aria-label={t.common.pagination.label} className="flex items-center justify-center gap-2">
            {page > 1 ? (
                <Link href={pageHref(basePath, query, page - 1)} className={linkClass}>
                    <ChevronLeftIcon data-icon="inline-start" className="rtl:rotate-180" />
                    {t.common.pagination.previous}
                </Link>
            ) : null}
            <span className="px-1 text-sm tabular-nums text-muted-foreground" aria-current="page">
                {t.common.pagination.pageOf(page, pages)}
            </span>
            {page < pages ? (
                <Link href={pageHref(basePath, query, page + 1)} className={linkClass}>
                    {t.common.pagination.next}
                    <ChevronRightIcon data-icon="inline-end" className="rtl:rotate-180" />
                </Link>
            ) : null}
        </nav>
    );
}
