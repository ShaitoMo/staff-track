import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDictionary } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { Branch } from "@/types/branch";

export async function BranchTable({ branches, canEdit }: { branches: Branch[]; canEdit: boolean }) {
    const t = await getDictionary();

    return (
        <div className="rounded-lg border border-border bg-card">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{t.setup.name}</TableHead>
                        <TableHead>{t.branches.location}</TableHead>
                        {canEdit && (
                            <TableHead className="text-end">
                                <span className="sr-only">{t.setup.actions}</span>
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
                                <TableCell className="text-end">
                                    <Link
                                        href={`/branches/${branch.branchId}/edit`}
                                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                                    >
                                        {t.common.edit}
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
