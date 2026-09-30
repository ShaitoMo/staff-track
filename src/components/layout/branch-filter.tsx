import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Branch } from "@/types/branch";

/** `extraQuery` carries params the page also depends on (e.g. a view or date) through each branch link. */
function hrefFor(basePath: string, extraQuery: Record<string, string>, branchId?: number): string {
    const params = new URLSearchParams(extraQuery);
    if (branchId !== undefined) {
        params.set("branch", String(branchId));
    }
    const query = params.toString();
    return query === "" ? basePath : `${basePath}?${query}`;
}

export function BranchFilter({
    basePath,
    branches,
    activeBranchId,
    extraQuery = {},
    showAll = true,
}: {
    basePath: string;
    branches: Branch[];
    activeBranchId?: number;
    extraQuery?: Record<string, string>;
    /** Hide the "All branches" link for screens that only make sense for one branch at a time. */
    showAll?: boolean;
}) {
    return (
        <div className="flex flex-wrap gap-2">
            {showAll ? (
                <Link
                    href={hrefFor(basePath, extraQuery)}
                    aria-current={activeBranchId === undefined ? "true" : undefined}
                    className={cn(buttonVariants({ variant: activeBranchId === undefined ? "default" : "outline", size: "sm" }))}
                >
                    All branches
                </Link>
            ) : null}
            {branches.map((branch) => (
                <Link
                    key={branch.branchId}
                    href={hrefFor(basePath, extraQuery, branch.branchId)}
                    aria-current={activeBranchId === branch.branchId ? "true" : undefined}
                    className={cn(buttonVariants({ variant: activeBranchId === branch.branchId ? "default" : "outline", size: "sm" }))}
                >
                    {branch.name}
                </Link>
            ))}
        </div>
    );
}
