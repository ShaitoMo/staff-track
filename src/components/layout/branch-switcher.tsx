"use client";

import { useEffect, useMemo, useSyncExternalStore, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronsUpDownIcon, StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { ALL_BRANCHES, BRANCH_COOKIE, branchCookieString, parseBranchId, resolveBranchId } from "@/lib/branch-selection";
import { TOUCH_HEIGHT } from "@/lib/touch";
import { cn } from "@/lib/utils";

const noSubscription = () => () => {};

function readBranchCookie(): string | undefined {
    const entry = document.cookie.split("; ").find((cookie) => cookie.startsWith(`${BRANCH_COOKIE}=`));
    return entry === undefined ? undefined : decodeURIComponent(entry.slice(BRANCH_COOKIE.length + 1));
}

/**
 * The branch every owner/manager page follows. The choice is a cookie the pages read on the server;
 * a `?branch=` link still wins, and following one counts as choosing that branch, so the next
 * section opened from the bar stays on it. Same resolution as the pages (`resolveBranchId`), so
 * the label always names what the page shows. The layout doesn't re-render between pages, so the
 * cookie is read live here rather than kept from the first request.
 */
export function BranchSwitcher({ branches, preference }: { branches: { branchId: number; name: string }[]; preference?: string }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [pending, startTransition] = useTransition();
    const saved = useSyncExternalStore(noSubscription, readBranchCookie, () => preference);

    // memoized: it's an effect dependency below, and a fresh array each render would rerun the effect every time
    const branchIds = useMemo(() => branches.map((branch) => branch.branchId), [branches]);
    const requested = searchParams.get("branch");
    const selectedId = resolveBranchId(requested, saved, branchIds);
    const selectedName = branches.find((branch) => branch.branchId === selectedId)?.name ?? "All branches";

    useEffect(() => {
        const linked = parseBranchId(requested);
        if (linked !== undefined && branchIds.includes(linked) && String(linked) !== readBranchCookie()) {
            document.cookie = branchCookieString(String(linked));
        }
    }, [requested, branchIds]);

    if (branches.length <= 1) {
        return (
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <StoreIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{branches[0]?.name ?? "No branch"}</span>
            </span>
        );
    }

    function choose(value: string) {
        document.cookie = branchCookieString(value);
        // drop a ?branch= link so the new choice isn't overruled; keep the rest (week, date, view)
        const params = new URLSearchParams(searchParams);
        params.delete("branch");
        const query = params.toString();
        startTransition(() => {
            router.replace(query === "" ? pathname : `${pathname}?${query}`, { scroll: false });
            router.refresh();
        });
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Branch: ${selectedName}. Change branch`}
                        className={cn("min-w-0 max-w-56 justify-start gap-2", TOUCH_HEIGHT)}
                    />
                }
            >
                {pending ? <Spinner data-icon="inline-start" /> : <StoreIcon aria-hidden className="text-muted-foreground" />}
                <span className="truncate">{selectedName}</span>
                <ChevronsUpDownIcon aria-hidden className="ml-auto text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>Branch</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={selectedId === undefined ? ALL_BRANCHES : String(selectedId)} onValueChange={choose}>
                        <DropdownMenuRadioItem value={ALL_BRANCHES} closeOnClick className={TOUCH_HEIGHT}>
                            All branches
                        </DropdownMenuRadioItem>
                        <DropdownMenuSeparator />
                        {branches.map((branch) => (
                            <DropdownMenuRadioItem key={branch.branchId} value={String(branch.branchId)} closeOnClick className={TOUCH_HEIGHT}>
                                <span className="truncate">{branch.name}</span>
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
