"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TOUCH_HEIGHT } from "@/lib/touch";
import { Spinner } from "@/components/ui/spinner";
import { logout } from "@/lib/api-client";

export function LogoutButton() {
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
        <Button variant="outline" size="sm" className={TOUCH_HEIGHT} onClick={handleLogout} disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            Log out
        </Button>
    );
}
