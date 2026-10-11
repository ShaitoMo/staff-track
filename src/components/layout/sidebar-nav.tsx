"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, MANAGER_NAV_GROUPS } from "@/components/layout/nav-items";
import { TOUCH_HEIGHT } from "@/lib/touch";
import { cn } from "@/lib/utils";

/**
 * The owner/manager sections, grouped by what they're for, on the dark sidebar tokens (globals.css);
 * the active one is a solid Market Blue pill. Shared by the desktop left bar and the
 * slide-out menu on narrow screens; `onCurrentPage` lets the menu close when the page already
 * showing is chosen, since that link doesn't navigate.
 */
export function SidebarNav({ onCurrentPage }: { onCurrentPage?: () => void }) {
    const pathname = usePathname();

    return (
        <nav aria-label="Sections" className="flex flex-col gap-5">
            {MANAGER_NAV_GROUPS.map((group) => (
                <div key={group.label} className="flex flex-col gap-0.5">
                    <h2 className="px-2.5 pb-1 text-xs font-medium tracking-[0.02em] text-sidebar-muted-foreground">{group.label}</h2>
                    <ul className="flex flex-col gap-0.5">
                        {group.items.map(({ href, label, icon: Icon }) => {
                            const active = isActive(href, pathname);
                            return (
                                <li key={href}>
                                    <Link
                                        href={href}
                                        onClick={href === pathname ? onCurrentPage : undefined}
                                        aria-current={active ? "page" : undefined}
                                        className={cn(
                                            "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors",
                                            active
                                                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                            TOUCH_HEIGHT,
                                        )}
                                    >
                                        <Icon aria-hidden className={cn("size-4 shrink-0", active ? "text-sidebar-primary-foreground" : "text-sidebar-muted-foreground")} />
                                        {label}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </nav>
    );
}
