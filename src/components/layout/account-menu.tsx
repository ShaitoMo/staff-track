"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, CircleUserIcon, KeyRoundIcon, LanguagesIcon, LogOutIcon } from "lucide-react";
import { ChangePasswordDialog } from "@/components/layout/change-password-dialog";
import { useSwitchLanguage } from "@/components/layout/language-switcher";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/i18n/client";
import { logout } from "@/lib/api-client";
import { TOUCH_HEIGHT } from "@/lib/touch";
import { cn } from "@/lib/utils";

/** Who is signed in, the language switch, Change password, and Log out. A phone shows just the icon; the name and role open with the menu. */
export function AccountMenu({ userId, name, role }: { userId: number; name: string | null; role: string }) {
    const router = useRouter();
    // a new key per opening remounts the dialog empty: no leftover "Password changed." or half-typed password
    const [passwordDialog, setPasswordDialog] = useState({ open: false, key: 0 });
    const [pending, startTransition] = useTransition();
    const t = useT();
    const language = useSwitchLanguage();

    function handleLogout() {
        startTransition(async () => {
            await logout().catch(() => undefined);
            router.push("/login");
            router.refresh();
        });
    }

    return (
        <>
        <DropdownMenu>
            <DropdownMenuTrigger
                render={<Button variant="ghost" size="sm" aria-label={t.layout.account(name ?? role)} className={cn("max-w-56 gap-2 [@media(pointer:coarse)]:min-w-11", TOUCH_HEIGHT)} />}
            >
                {pending || language.pending ? <Spinner data-icon="inline-start" /> : <CircleUserIcon aria-hidden className="text-muted-foreground" />}
                <span className="hidden min-w-0 items-baseline gap-1.5 sm:flex">
                    {name !== null ? <span className="truncate font-medium"><bdi>{name}</bdi></span> : null}
                    <span className="shrink-0 font-normal text-muted-foreground capitalize">{role}</span>
                </span>
                <ChevronDownIcon aria-hidden className="hidden text-muted-foreground sm:block" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                    <DropdownMenuLabel className="flex flex-col gap-0.5 text-sm">
                        {name !== null ? <span className="truncate font-medium text-foreground"><bdi>{name}</bdi></span> : null}
                        <span className="text-xs font-normal capitalize">{role}</span>
                    </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={language.switchLanguage} lang={language.other} className={TOUCH_HEIGHT}>
                    <LanguagesIcon aria-hidden />
                    {language.label}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPasswordDialog((current) => ({ open: true, key: current.key + 1 }))} className={TOUCH_HEIGHT}>
                    <KeyRoundIcon aria-hidden />
                    {t.password.change}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} disabled={pending} className={TOUCH_HEIGHT}>
                    <LogOutIcon aria-hidden />
                    {t.layout.logOut}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
        {/* outside the menu: choosing the item closes the menu, which would unmount a dialog rendered inside it */}
        <ChangePasswordDialog
            key={passwordDialog.key}
            userId={userId}
            open={passwordDialog.open}
            onOpenChange={(open) => setPasswordDialog((current) => ({ ...current, open }))}
        />
        </>
    );
}
