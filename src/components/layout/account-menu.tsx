"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, CircleUserIcon, LogOutIcon } from "lucide-react";
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
import { logout } from "@/lib/api-client";
import { TOUCH_HEIGHT } from "@/lib/touch";
import { cn } from "@/lib/utils";

/** Who is signed in, and Log out. A phone shows just the icon; the name and role open with the menu. */
export function AccountMenu({ name, role }: { name: string | null; role: string }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();

    function handleLogout() {
        startTransition(async () => {
            await logout().catch(() => undefined);
            router.push("/login");
            router.refresh();
        });
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={<Button variant="ghost" size="sm" aria-label={`Account: ${name ?? role}`} className={cn("max-w-56 gap-2 [@media(pointer:coarse)]:min-w-11", TOUCH_HEIGHT)} />}
            >
                {pending ? <Spinner data-icon="inline-start" /> : <CircleUserIcon aria-hidden className="text-muted-foreground" />}
                <span className="hidden min-w-0 items-baseline gap-1.5 sm:flex">
                    {name !== null ? <span className="truncate font-medium">{name}</span> : null}
                    <span className="shrink-0 font-normal text-muted-foreground capitalize">{role}</span>
                </span>
                <ChevronDownIcon aria-hidden className="hidden text-muted-foreground sm:block" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                    <DropdownMenuLabel className="flex flex-col gap-0.5 text-sm">
                        {name !== null ? <span className="truncate font-medium text-foreground">{name}</span> : null}
                        <span className="text-xs font-normal capitalize">{role}</span>
                    </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} disabled={pending} className={TOUCH_HEIGHT}>
                    <LogOutIcon aria-hidden />
                    Log out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
