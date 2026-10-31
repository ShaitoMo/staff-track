import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getI18n } from "@/i18n/server";
import { formatDay, WeeklyCoverageRow } from "@/lib/coverage-rows";
import { NEEDS_DOT } from "@/lib/schedule-grid";
import { cn } from "@/lib/utils";

export async function WeeklyCoverage({ rows, dates }: { rows: WeeklyCoverageRow[]; dates: string[] }) {
    const { t, locale } = await getI18n();

    if (rows.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>{t.coverage.noRequirements}</EmptyTitle>
                    <EmptyDescription>{t.coverage.noRequirementsDescription}</EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <div className="rounded-lg border border-border bg-card">
            <Table>
                <TableCaption className="sr-only">
                    {t.coverage.weeklyCaption}
                </TableCaption>
                <TableHeader>
                    <TableRow>
                        <TableHead scope="col" className="sticky start-0 z-10 bg-card">{t.coverage.role}</TableHead>
                        {dates.map((date) => (
                            <TableHead key={date} scope="col" className="whitespace-nowrap">
                                {formatDay(date, locale)}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={`${row.roleName}-${row.periodName}`}>
                            <TableHead scope="row" className="sticky start-0 z-10 h-auto bg-card py-2 capitalize">
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
                                                <span className="sr-only">{t.coverage.shortBy(day.shortfall)}</span>
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
