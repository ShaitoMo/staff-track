import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDay } from "@/lib/coverage-rows";
import { NEEDS_DOT, RoleCell, RoleRow } from "@/lib/schedule-grid";
import { cn } from "@/lib/utils";
import { ShiftPeriodView } from "@/types/shift-period";

/**
 * The week as a finished schedule: who works each slot, nothing to click. The same shape as the
 * editing grid (periods, then roles, days across) so switching between the two never reorients
 * anyone. Server-rendered with no client JS, and laid out to print on one landscape page: a fixed
 * table whose seven days share the width, so the week never scrolls off the edge.
 */
export function ScheduleRoster({
    dates,
    today,
    periods,
    roleRows,
}: {
    dates: string[];
    today: string;
    periods: ShiftPeriodView[];
    roleRows: RoleRow[];
}) {
    // a role nobody works and nothing needs all week is a row of dashes: the screen drops it, and paper,
    // which shows only who works, drops every row without a name (and a period left with none)
    const groups = periods.flatMap((period) => {
        const rows = roleRows.filter((row) => row.periodId === period.periodId && (hasPeople(row) || hasNeed(row)));
        return rows.length === 0 ? [] : [{ period, rows, printed: rows.some(hasPeople) }];
    });

    // today keeps the editing grid's tint on screen; a printed week has no "today", so paper drops it
    const dayCell = (date: string) => cn("align-top whitespace-normal print:py-1", date === today && "bg-muted print:bg-transparent");
    // the slot column stays put while a narrow screen scrolls the days under it
    const slotCell = "sticky left-0 z-10 border-r border-border bg-card print:static";

    return (
        <div className="overflow-x-auto rounded-lg border border-border bg-card print:overflow-visible print:rounded-none print:border-0">
            <Table className="min-w-[56rem] table-fixed print:min-w-0 print:text-xs">
                <TableCaption className="sr-only">
                    Weekly schedule by shift period: who works each role, and the register each person is on
                </TableCaption>
                <colgroup>
                    <col className="w-28 print:w-24" />
                    {dates.map((date) => (
                        <col key={date} />
                    ))}
                </colgroup>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        <TableHead scope="col" className={cn(slotCell, "text-xs text-muted-foreground")}>
                            Slot
                        </TableHead>
                        {dates.map((date) => (
                            <TableHead
                                key={date}
                                scope="col"
                                aria-current={date === today ? "date" : undefined}
                                className={cn("whitespace-nowrap", date === today && "bg-muted font-semibold print:bg-transparent print:font-medium")}
                            >
                                {formatDay(date)}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                {groups.map(({ period, rows, printed }) => (
                    // one body per period, so a printed page never splits a shift across two sheets
                    <TableBody
                        key={period.periodId}
                        className={cn("break-inside-avoid border-t border-border first-of-type:border-t-0", !printed && "print:hidden")}
                    >
                        {/* the week's main division: weight and space above it, no fill (today's column is the one tint) */}
                        <TableRow className="hover:bg-transparent">
                            <TableHead scope="colgroup" colSpan={dates.length + 1} className="h-10 pt-4 font-semibold text-foreground print:h-7 print:pt-2">
                                <span className="sticky left-2 inline-flex items-baseline gap-2 print:static">
                                    {period.name}
                                    <PeriodHours period={period} />
                                </span>
                            </TableHead>
                        </TableRow>
                        {rows.map((row) => (
                            <TableRow key={row.roleId} className={cn("hover:bg-transparent", !hasPeople(row) && "print:hidden")}>
                                <TableHead scope="row" className={cn(slotCell, "h-auto py-2 align-top font-medium whitespace-normal capitalize print:py-1")}>
                                    {row.roleName}
                                </TableHead>
                                {row.cells.map((cell) => (
                                    <TableCell key={cell.date} className={dayCell(cell.date)}>
                                        <RoleCellText cell={cell} />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                ))}
            </Table>
        </div>
    );
}

/** A period's default hours beside its name; shared with the editing grid so both headings match. */
export function PeriodHours({ period }: { period: ShiftPeriodView }) {
    return (
        <span className="font-mono text-xs font-normal text-muted-foreground tabular-nums">
            {period.defaultStart}–{period.defaultEnd}
        </span>
    );
}

const hasPeople = (row: RoleRow) => row.cells.some((cell) => cell.people.length > 0);
const hasNeed = (row: RoleRow) => row.cells.some((cell) => cell.shortfall > 0);

/**
 * Names, each with its register when it has one; then, on screen only, what the slot still needs.
 * An empty slot is a quiet dash: always when nothing is needed, and on paper, where the need is hidden.
 */
function RoleCellText({ cell }: { cell: RoleCell }) {
    const dash = <span className="text-muted-foreground">—</span>;

    if (cell.people.length === 0 && cell.shortfall === 0) {
        return dash;
    }

    return (
        <>
            {cell.people.length === 0 ? <span className="hidden print:inline">{dash}</span> : null}
            <RoleCellList cell={cell} />
        </>
    );
}

function RoleCellList({ cell }: { cell: RoleCell }) {
    return (
        <ul className="flex flex-col gap-1.5 print:gap-0.5">
            {cell.people.map((person) => (
                <li key={person.shiftId} className="leading-snug">
                    <span className="block">{person.name}</span>
                    {person.registerName !== null ? (
                        <span className="block text-xs text-muted-foreground">{person.registerName}</span>
                    ) : null}
                </li>
            ))}
            {cell.shortfall > 0 ? (
                <li className="flex items-center gap-1.5 text-xs text-muted-foreground print:hidden">
                    <span aria-hidden="true" className={NEEDS_DOT} />
                    Needs {cell.shortfall}
                </li>
            ) : null}
        </ul>
    );
}
