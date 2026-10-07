import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDay, WeeklyCoverageRow } from "@/lib/coverage-rows";
import { NEEDS_DOT } from "@/lib/schedule-grid";
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
        <div className="rounded-lg border border-border bg-card">
            <Table>
                <TableCaption className="sr-only">
                    People scheduled compared with people required, per role, shift period and day
                </TableCaption>
                <TableHeader>
                    <TableRow>
                        <TableHead scope="col" className="sticky left-0 z-10 bg-card">Role</TableHead>
                        {dates.map((date) => (
                            <TableHead key={date} scope="col" className="whitespace-nowrap">
                                {formatDay(date)}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={`${row.roleName}-${row.periodName}`}>
                            <TableHead scope="row" className="sticky left-0 z-10 h-auto bg-card py-2">
                                {row.roleName}
                                <span className="block text-xs font-normal text-muted-foreground">{row.periodName}</span>
                            </TableHead>
                            {row.days.map((day) => (
                                <TableCell
                                    key={day.shiftDate}
                                    className={cn("font-mono tabular-nums", day.required === 0 && "text-muted-foreground")}
                                >
                                    {/* the schedule grid's mark for a short slot: a dot, with the gap in muted text, not a red cell */}
                                    <span className="inline-flex items-center gap-1.5">
                                        {day.shortfall > 0 ? <span aria-hidden="true" className={NEEDS_DOT} /> : null}
                                        {day.scheduled} / {day.required}
                                        {day.shortfall > 0 ? (
                                            <>
                                                <span aria-hidden="true" className="text-muted-foreground">(−{day.shortfall})</span>
                                                <span className="sr-only">, short by {day.shortfall}</span>
                                            </>
                                        ) : null}
                                    </span>
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
