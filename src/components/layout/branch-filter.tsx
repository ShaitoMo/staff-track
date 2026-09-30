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
}: {
    basePath: string;
    branches: Branch[];
    activeBranchId?: number;
    extraQuery?: Record<string, string>;
}) {
    return (
        <div className="flex flex-wrap gap-2">
            <Link
                href={hrefFor(basePath, extraQuery)}
                className={cn(buttonVariants({ variant: activeBranchId === undefined ? "default" : "outline", size: "sm" }))}
            >
                All branches
            </Link>
            {branches.map((branch) => (
                <Link
                    key={branch.branchId}
                    href={hrefFor(basePath, extraQuery, branch.branchId)}
                    className={cn(buttonVariants({ variant: activeBranchId === branch.branchId ? "default" : "outline", size: "sm" }))}
                >
                    {branch.name}
                </Link>
            ))}
        </div>
    );
}
