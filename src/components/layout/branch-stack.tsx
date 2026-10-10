import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";
import { TOUCH_HEIGHT } from "@/lib/touch";
import { cn } from "@/lib/utils";
import { Branch } from "@/types/branch";

/**
 * A per-branch page with "All branches" chosen in the top bar: each branch's view, one under
 * another. Each folds away (a native <details>, so no client JS) and can be opened on its own.
 * `query` carries the page's other params (e.g. week) into that link.
 */
export function BranchStack({
    branches,
    basePath,
    query,
    heading: Heading = "h2",
    children,
}: {
    branches: Branch[];
    basePath: string;
    query: Record<string, string>;
    heading?: "h2" | "h3";
    children: (branch: Branch) => ReactNode;
}) {
    return (
        <div className="flex flex-col gap-8">
            {branches.map((branch) => (
                <details key={branch.branchId} open className="group border-t border-border pt-4">
                    <summary
                        className={cn(
                            "flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden",
                            TOUCH_HEIGHT,
                        )}
                    >
                        <span className="flex min-w-0 items-center gap-2">
                            <ChevronDownIcon
                                aria-hidden
                                className="size-4 shrink-0 text-muted-foreground transition-transform group-not-open:-rotate-90"
                            />
                            <Heading className="truncate text-base font-semibold">{branch.name}</Heading>
                        </span>
                        <Link
                            href={`${basePath}?${new URLSearchParams({ ...query, branch: String(branch.branchId) })}`}
                            className={cn("inline-flex shrink-0 items-center text-sm text-primary underline-offset-4 hover:underline", TOUCH_HEIGHT)}
                        >
                            Only this branch
                        </Link>
                    </summary>
                    <div className="pt-4">{children(branch)}</div>
                </details>
            ))}
        </div>
    );
}
