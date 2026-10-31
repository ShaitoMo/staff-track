import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDictionary } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { UserRow } from "@/lib/user-rows";

export async function UserTable({ rows }: { rows: UserRow[] }) {
    const t = await getDictionary();

    return (
        <div className="hidden rounded-lg border border-border bg-card md:block">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{t.setup.name}</TableHead>
                        <TableHead>{t.users.role}</TableHead>
                        <TableHead>{t.setup.status}</TableHead>
                        <TableHead>{t.users.branches}</TableHead>
                        <TableHead className="text-end">
                            <span className="sr-only">{t.setup.actions}</span>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={row.userId}>
                            <TableCell>
                                <div className="font-medium">{row.name}</div>
                                <div className="font-mono text-xs text-muted-foreground"><bdi dir="ltr">{row.phone}</bdi></div>
                            </TableCell>
                            <TableCell className="capitalize">{row.roleName}</TableCell>
                            <TableCell>
                                <Badge variant="outline" className={cn(!row.isActive && "border-dashed text-muted-foreground")}>
                                    {row.isActive ? t.setup.active : t.setup.inactive}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-wrap gap-1">
                                    {row.branchChips.map((chip) => (
                                        <Badge key={chip} variant="secondary">{chip}</Badge>
                                    ))}
                                </div>
                            </TableCell>
                            <TableCell className="text-end">
                                <Link
                                    href={`/users/${row.userId}/edit`}
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
