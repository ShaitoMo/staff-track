import { PeriodRowActions } from "@/components/periods/period-row-actions";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PeriodRow } from "@/lib/period-rows";
import { getDictionary } from "@/i18n/server";
import { cn } from "@/lib/utils";

export async function PeriodTable({ rows }: { rows: PeriodRow[] }) {
    const t = await getDictionary();

    return (
        <div className="rounded-lg border border-border bg-card">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{t.periods.period}</TableHead>
                        <TableHead>{t.periods.hours}</TableHead>
                        <TableHead>{t.setup.branch}</TableHead>
                        <TableHead>{t.setup.status}</TableHead>
                        <TableHead className="text-end">
                            <span className="sr-only">{t.setup.actions}</span>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={row.periodId}>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell className="font-mono tabular-nums"><bdi dir="ltr">{row.hours}</bdi></TableCell>
                            <TableCell className="text-muted-foreground">{row.branchName}</TableCell>
                            <TableCell>
                                <Badge variant="outline" className={cn(!row.active && "border-dashed text-muted-foreground")}>
                                    {row.active ? t.setup.active : t.setup.inactive}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-end">
                                {row.canChange ? (
                                    <PeriodRowActions periodId={row.periodId} name={row.name} active={row.active} />
                                ) : (
                                    <span className="text-xs text-muted-foreground">{t.periods.ownerOnly}</span>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
