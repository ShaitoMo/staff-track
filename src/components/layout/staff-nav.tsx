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
                            active ? "bg-primary/8 text-primary" : "text-foreground hover:bg-muted",
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
            className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
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
                                    "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium",
                                    active ? "text-primary" : "text-muted-foreground",
                                )}
                            >
                                {/* the left bar's active pill, sized for a thumb: Market Blue behind the icon */}
                                <span
                                    className={cn(
                                        "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                                        active && "bg-primary text-primary-foreground",
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
