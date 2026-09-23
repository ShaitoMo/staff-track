import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Branch } from "@/types/branch";

export function BranchTable({ branches, canEdit }: { branches: Branch[]; canEdit: boolean }) {
    return (
        <div className="rounded-lg border border-border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Location</TableHead>
                        {canEdit && (
                            <TableHead className="text-right">
                                <span className="sr-only">Actions</span>
                            </TableHead>
                        )}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {branches.map((branch) => (
                        <TableRow key={branch.branchId}>
                            <TableCell className="font-medium">{branch.name}</TableCell>
                            <TableCell className="text-muted-foreground">{branch.location ?? "—"}</TableCell>
                            {canEdit && (
                                <TableCell className="text-right">
                                    <Link
                                        href={`/branches/${branch.branchId}/edit`}
                                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                                    >
                                        Edit
                                    </Link>
                                </TableCell>
                            )}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
