import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDictionary } from "@/i18n/server";
import { cn } from "@/lib/utils";

export interface RegisterRow {
    registerId: number;
    name: string;
    branchName: string;
}

export async function RegisterTable({ rows }: { rows: RegisterRow[] }) {
    const t = await getDictionary();

    return (
        <div className="rounded-lg border border-border bg-card">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{t.registers.register}</TableHead>
                        <TableHead>{t.setup.branch}</TableHead>
                        <TableHead className="text-end">
                            <span className="sr-only">{t.setup.actions}</span>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={row.registerId}>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell className="text-muted-foreground">{row.branchName}</TableCell>
                            <TableCell className="text-end">
                                <Link
                                    href={`/registers/${row.registerId}/edit`}
                                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                                >
                                    {t.common.edit}
                                </Link>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
