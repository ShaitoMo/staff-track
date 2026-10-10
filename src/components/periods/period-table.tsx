import { PeriodRowActions } from "@/components/periods/period-row-actions";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PeriodRow } from "@/lib/period-rows";
import { cn } from "@/lib/utils";

export function PeriodTable({ rows }: { rows: PeriodRow[] }) {
    return (
        <div className="rounded-lg border border-border bg-card">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">
                            <span className="sr-only">Actions</span>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={row.periodId}>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell className="font-mono tabular-nums">{row.hours}</TableCell>
                            <TableCell className="text-muted-foreground">{row.branchName}</TableCell>
                            <TableCell>
                                <Badge variant="outline" className={cn(!row.active && "border-dashed text-muted-foreground")}>
                                    {row.active ? "Active" : "Inactive"}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                {row.canChange ? (
                                    <PeriodRowActions periodId={row.periodId} name={row.name} active={row.active} />
                                ) : (
                                    <span className="text-xs text-muted-foreground">Owner only</span>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
