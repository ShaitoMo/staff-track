import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Branch } from "@/types/branch";

export function BranchFilter({
    branches,
    activeBranchId,
}: {
    branches: Branch[];
    activeBranchId?: number;
}) {
    return (
        <div className="flex flex-wrap gap-2">
            <Link
                href="/users"
                className={cn(buttonVariants({ variant: activeBranchId === undefined ? "default" : "outline", size: "sm" }))}
            >
                All branches
            </Link>
            {branches.map((branch) => (
                <Link
                    key={branch.branchId}
                    href={`/users?branch=${branch.branchId}`}
                    className={cn(buttonVariants({ variant: activeBranchId === branch.branchId ? "default" : "outline", size: "sm" }))}
                >
                    {branch.name}
                </Link>
            ))}
        </div>
    );
}
