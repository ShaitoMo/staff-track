"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TOUCH_HEIGHT } from "@/lib/touch";
import { cn } from "@/lib/utils";

/** The header links, marking the page you're on (Market Blue is DESIGN.md's active-nav colour). */
export function AppNav({ items }: { items: { href: string; label: string }[] }) {
    const pathname = usePathname();

    return (
        <nav className="order-last flex w-full flex-wrap items-center gap-x-4 gap-y-1 md:order-none md:w-auto">
            {items.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                            "inline-flex items-center text-sm font-medium hover:text-primary",
                            active ? "text-primary" : "text-foreground",
                            TOUCH_HEIGHT,
                        )}
                    >
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
}
