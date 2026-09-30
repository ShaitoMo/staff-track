import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDay, WeeklyCoverageRow } from "@/lib/coverage-rows";
import { cn } from "@/lib/utils";

export function WeeklyCoverage({ rows, dates }: { rows: WeeklyCoverageRow[]; dates: string[] }) {
    if (rows.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>No requirements set</EmptyTitle>
                    <EmptyDescription>Set how many people each role needs above to see coverage here.</EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Role</TableHead>
                        {dates.map((date) => (
                            <TableHead key={date} className="whitespace-nowrap">
                                {formatDay(date)}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={`${row.roleName}-${row.periodName}`}>
                            <TableCell>
                                <div className="font-medium">{row.roleName}</div>
                                <div className="text-xs text-muted-foreground">{row.periodName}</div>
                            </TableCell>
                            {row.days.map((day) => (
                                <TableCell
                                    key={day.shiftDate}
                                    className={cn(
                                        "font-mono tabular-nums",
                                        day.required === 0 && "text-muted-foreground",
                                        day.shortfall > 0 && "font-medium text-destructive",
                                    )}
                                >
                                    {day.scheduled} / {day.required}
                                    {day.shortfall > 0 ? (
                                        <>
                                            <span aria-hidden="true" className="ml-1">(−{day.shortfall})</span>
                                            <span className="sr-only">, short by {day.shortfall}</span>
                                        </>
                                    ) : null}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
