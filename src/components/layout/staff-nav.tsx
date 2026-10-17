"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, STAFF_NAV } from "@/components/layout/nav-items";
import { TOUCH_HEIGHT } from "@/lib/touch";
import { cn } from "@/lib/utils";

/** Staff sections as top-bar links, from `md` up; a phone gets StaffTabBar instead. */
export function StaffNav() {
    const pathname = usePathname();

    return (
        <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
            {STAFF_NAV.map(({ href, label }) => {
                const active = isActive(href, pathname);
                return (
                    <Link
                        key={href}
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                            "inline-flex h-8 items-center rounded-md px-2.5 text-sm font-medium transition-colors",
                            // where you are is a soft ink tint, never blue, which marks actions (same as the tab bar)
                            active ? "bg-foreground/8 text-foreground" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                            TOUCH_HEIGHT,
                        )}
                    >
                        {label}
                    </Link>
                );
            })}
        </nav>
    );
}

/**
 * Staff on a phone, mid-shift: the four sections fixed at the bottom, within thumb reach. Each tab
 * is the full cell (64px tall), and the bar clears the home indicator on phones that have one.
 */
export function StaffTabBar() {
    const pathname = usePathname();

    return (
        <nav
            aria-label="Sections"
            className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
        >
            <ul className="grid grid-cols-4">
                {STAFF_NAV.map(({ href, label, icon: Icon }) => {
                    const active = isActive(href, pathname);
                    return (
                        <li key={href}>
                            <Link
                                href={href}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                    "flex h-16 flex-col items-center justify-center gap-1 text-xs",
                                    active ? "font-semibold text-foreground" : "font-medium text-muted-foreground",
                                )}
                            >
                                {/* where you are: a soft ink pill behind the icon and a heavier label — not blue */}
                                <span
                                    className={cn(
                                        "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                                        active && "bg-foreground/8",
                                    )}
                                >
                                    <Icon aria-hidden className="size-5" />
                                </span>
                                {label}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
