"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { MenuIcon, XIcon } from "lucide-react";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useLocale, useT } from "@/i18n/client";
import { dirOf } from "@/i18n/locales";
import { TOUCH_SIZE } from "@/lib/touch";
import { cn } from "@/lib/utils";

/**
 * Below `lg` the left bar becomes this slide-out menu. It is open only while the page it was opened
 * on is still showing, so choosing a section closes it once the new page arrives — closing it from
 * the link's own click unmounted the link before Next could navigate.
 */
export function MobileNav() {
    const pathname = usePathname();
    const [openOn, setOpenOn] = useState<string | null>(null);
    const t = useT();
    // the menu slides in from the side the left bar sits on: the right, in Arabic
    const side = dirOf(useLocale()) === "rtl" ? "right" : "left";

    return (
        <Sheet open={openOn === pathname} onOpenChange={(open) => setOpenOn(open ? pathname : null)}>
            <SheetTrigger render={<Button variant="ghost" size="icon" aria-label={t.layout.openMenu} className={TOUCH_SIZE} />}>
                <MenuIcon />
            </SheetTrigger>
            {/* the same dark surface as the desktop left bar */}
            <SheetContent side={side} showCloseButton={false} className="w-64 gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
                <div className="flex h-14 shrink-0 items-center justify-between px-4">
                    <SheetTitle className="text-base font-semibold text-sidebar-foreground">{t.common.appName}</SheetTitle>
                    <SheetClose
                        render={
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={t.layout.closeMenu}
                                className={cn("text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-foreground/60", TOUCH_SIZE)}
                            />
                        }
                    >
                        <XIcon />
                    </SheetClose>
                </div>
                <div className="overflow-y-auto px-3 py-4">
                    {/* the page you're already on doesn't navigate, so that one link closes the menu itself */}
                    <SidebarNav onCurrentPage={() => setOpenOn(null)} />
                </div>
            </SheetContent>
        </Sheet>
    );
}
