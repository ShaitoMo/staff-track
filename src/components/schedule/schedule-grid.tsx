"use client";

import { Fragment, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyIcon, PlusIcon, XIcon } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DayHeading } from "@/components/schedule/day-heading";
import { PeriodHours } from "@/components/schedule/period-hours";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Dictionary } from "@/i18n/dictionaries";
import { useLocale, useT } from "@/i18n/client";
import { isolate } from "@/i18n/locales";
import { ApiError } from "@/lib/api-client";
import { copyWeek, createShift, deleteShift, setShiftRegister } from "@/lib/api/shifts";
import { addDays, formatDay, formatDayStacked } from "@/lib/coverage-rows";
import {
    NEEDS_DOT,
    OpenRegisterRow,
    RegisterSeat,
    RoleRow,
    SchedulePerson,
    slotKey,
    StaffMember,
} from "@/lib/schedule-grid";
import { TOUCH_HEIGHT } from "@/lib/touch";
import { CHOSEN } from "@/lib/selection";
import { cn } from "@/lib/utils";
import { ShiftPeriodView } from "@/types/shift-period";

/** Tailwind's `xl`: from here up the whole week fits as a table; below it, one day at a time. */
const WIDE_QUERY = "(min-width: 80rem)";

function subscribeToWidth(onChange: () => void): () => void {
    const query = window.matchMedia(WIDE_QUERY);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
}

/**
 * Which schedule layout to mount. The server can't know the screen, so it renders "both" and CSS
 * shows the right one (no flash on first paint); once hydrated, only the visible layout stays
 * mounted, so each refresh after an edit re-renders one set of cells, not two.
 */
function useLayout(): "both" | "table" | "day" {
    return useSyncExternalStore(
        subscribeToWidth,
        () => (window.matchMedia(WIDE_QUERY).matches ? "table" : "day"),
        () => "both",
    );
}

/** Runs one schedule edit, then refreshes the server data; keeps its own pending and error state per cell. */
function useScheduleAction() {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const t = useT();

    function run(action: () => Promise<void>) {
        setError(null);
        startTransition(async () => {
            try {
                await action();
                router.refresh();
            } catch (caught) {
                setError(caught instanceof ApiError ? caught.message : t.common.somethingWentWrong);
            }
        });
    }

    return { pending, error, run };
}

/** `tag` sits between the name and the remove button — the register a person works, when there is one to show. */
function PersonChip({
    person,
    label,
    disabled,
    onRemove,
    tag,
}: {
    person: SchedulePerson;
    label: string;
    disabled: boolean;
    onRemove: () => void;
    tag?: React.ReactNode;
}) {
    return (
        <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-card py-0.5 pe-0.5 ps-2 text-xs">
            {/* in a narrow day column the register wraps under the name, as on the read-only schedule */}
            <span className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5">
                {person.name}
                {tag}
            </span>
            <button
                type="button"
                aria-label={label}
                disabled={disabled}
                onClick={onRemove}
                className="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 [@media(pointer:coarse)]:size-8"
            >
                <XIcon className="size-3" />
            </button>
        </span>
    );
}

interface PickerGroup {
    label: string;
    options: { value: string; name: string }[];
}

function PickerOptions({ groups }: { groups: PickerGroup[] }) {
    return (
        <SelectContent alignItemWithTrigger={false}>
            {groups.map((group) => (
                <SelectGroup key={group.label}>
                    {groups.length > 1 ? <SelectLabel>{group.label}</SelectLabel> : null}
                    {group.options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.name}
                        </SelectItem>
                    ))}
                </SelectGroup>
            ))}
        </SelectContent>
    );
}

/** A Select that never holds a value: picking an option fires `onPick` and the cell re-renders from fresh data. */
function PersonPicker({
    placeholder,
    label,
    groups,
    disabled,
    onPick,
}: {
    placeholder: string;
    label: string;
    groups: PickerGroup[];
    disabled: boolean;
    onPick: (value: string) => void;
}) {
    const nonEmpty = groups.filter((group) => group.options.length > 0);

    if (nonEmpty.length === 0) {
        return null;
    }

    return (
        <Select value="" onValueChange={(value) => value && onPick(String(value))} disabled={disabled}>
            {/* Ghost-styled so 7 × N pickers don't outweigh the people already scheduled; the chevron is dropped for the plus. */}
            <SelectTrigger
                size="sm"
                aria-label={label}
                className={cn(
                    "-ms-1 gap-1 border-transparent px-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground data-popup-open:bg-muted data-popup-open:text-foreground [&>svg:last-child]:hidden",
                    TOUCH_HEIGHT,
                )}
            >
                <PlusIcon className="size-3.5" aria-hidden="true" />
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <PickerOptions groups={nonEmpty} />
        </Select>
    );
}

const NO_REGISTER = "none";

/**
 * The register on a person's chip: shows where they work, and is itself the control to move them
 * to another free register or take them off. Hidden when there is nothing to show or choose.
 */
function RegisterTag({
    person,
    openSeats,
    where,
    disabled,
    onPick,
}: {
    person: SchedulePerson;
    openSeats: RegisterSeat[];
    where: string;
    disabled: boolean;
    onPick: (registerId: number | null) => void;
}) {
    if (person.registerId === null && openSeats.length === 0) {
        return null;
    }

    return <RegisterSelect person={person} openSeats={openSeats} where={where} disabled={disabled} onPick={onPick} />;
}

/** RegisterTag's control, split out so the early return above stays ahead of any hook. */
function RegisterSelect({
    person,
    openSeats,
    where,
    disabled,
    onPick,
}: {
    person: SchedulePerson;
    openSeats: RegisterSeat[];
    where: string;
    disabled: boolean;
    onPick: (registerId: number | null) => void;
}) {
    const t = useT();
    const options = [
        ...openSeats.map((seat) => ({ value: String(seat.registerId), name: seat.name })),
        ...(person.registerId === null ? [] : [{ value: NO_REGISTER, name: t.schedule.noRegister }]),
    ];

    return (
        <Select
            value=""
            onValueChange={(value) => value && onPick(value === NO_REGISTER ? null : Number(value))}
            disabled={disabled || options.length === 0}
        >
            <SelectTrigger
                size="sm"
                aria-label={
                    person.registerName
                        ? t.schedule.changeRegister(person.name, person.registerName, where)
                        : t.schedule.putOnRegister(person.name, where)
                }
                className={cn(
                    "h-5 gap-0.5 rounded-sm px-1 py-0 text-xs data-[size=sm]:h-5 [&>svg:last-child]:hidden [@media(pointer:coarse)]:h-8",
                    person.registerName
                        ? "border-foreground/15 bg-muted text-foreground hover:border-foreground/30"
                        : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
            >
                {person.registerName ?? (
                    <>
                        <PlusIcon className="size-3" aria-hidden="true" />
                        {t.schedule.registerTag}
                    </>
                )}
            </SelectTrigger>
            <PickerOptions groups={[{ label: t.schedule.register, options }]} />
        </Select>
    );
}

function CellShell({ pending, error, children }: { pending: boolean; error: string | null; children: React.ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col items-start gap-1.5">
            {children}
            {pending ? <Spinner /> : null}
            {error ? (
                <p role="alert" className="text-xs text-destructive">
                    {error}
                </p>
            ) : null}
        </div>
    );
}

/**
 * Building the week happens here: the Add picker offers "on Register 2" groups next to "No register",
 * so one pick creates the shift already seated.
 */
function RoleCellView({
    branchId,
    row,
    cellIndex,
    staff,
    busy,
    openSeats,
}: {
    branchId: number;
    row: RoleRow;
    cellIndex: number;
    staff: StaffMember[];
    busy: Set<number>;
    openSeats: RegisterSeat[];
}) {
    const { pending, error, run } = useScheduleAction();
    const t = useT();
    const locale = useLocale();
    const cell = row.cells[cellIndex];
    // each name isolated on its own, so an English role or period doesn't reorder the Arabic around it
    const where = [isolate(row.roleName), isolate(row.periodName), formatDay(cell.date, locale)].join(t.common.listSeparator);
    const free = staff.filter((member) => member.roleId === row.roleId && !busy.has(member.userId));
    const optionsFor = (registerId: number | null) =>
        free.map((member) => ({ value: `${member.userId}:${registerId ?? NO_REGISTER}`, name: member.name }));

    function add(value: string) {
        const [userId, registerId] = value.split(":");
        run(() =>
            createShift({
                user_id: Number(userId),
                branch_id: branchId,
                period_id: row.periodId,
                shift_date: cell.date,
                ...(registerId === NO_REGISTER ? {} : { register_id: Number(registerId) }),
            }),
        );
    }

    return (
        <CellShell pending={pending} error={error}>
            {/* A met slot shows only its people; the number appears only when someone is still needed. */}
            {cell.shortfall > 0 ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <span aria-hidden="true" className={NEEDS_DOT} />
                    {t.schedule.needs(cell.shortfall)}
                    <span className="sr-only">{t.schedule.needsMoreOf(cell.required)}</span>
                </span>
            ) : null}
            {cell.people.map((person) => (
                <PersonChip
                    key={person.shiftId}
                    person={person}
                    label={t.schedule.removeFrom(person.name, where)}
                    disabled={pending}
                    onRemove={() => run(() => deleteShift(person.shiftId))}
                    tag={
                        <RegisterTag
                            person={person}
                            openSeats={openSeats}
                            where={where}
                            disabled={pending}
                            onPick={(registerId) => run(() => setShiftRegister(person.shiftId, registerId))}
                        />
                    }
                />
            ))}
            <PersonPicker
                placeholder={t.schedule.add}
                label={t.schedule.addTo(where)}
                groups={[
                    ...openSeats.map((seat) => ({ label: t.schedule.onRegister(seat.name), options: optionsFor(seat.registerId) })),
                    { label: t.schedule.noRegister, options: optionsFor(null) },
                ]}
                disabled={pending}
                onPick={add}
            />
            {free.length === 0 && cell.shortfall > 0 ? (
                <span className="text-xs text-muted-foreground">{t.schedule.noneFree(row.roleName)}</span>
            ) : null}
        </CellShell>
    );
}

/**
 * A period's heading row: its name and hours, spanning the week. No fill — today's column is the grid's
 * one tint — so weight and the space above it mark the week's main division. Matches ScheduleRoster's.
 */
function PeriodRow({ period, colSpan }: { period: ShiftPeriodView; colSpan: number }) {
    return (
        <TableRow className="hover:bg-transparent">
            <TableHead scope="colgroup" colSpan={colSpan} className="h-10 pt-4 font-semibold text-foreground">
                <span className="sticky start-2 inline-flex items-baseline gap-2">
                    {period.name}
                    <PeriodHours period={period} />
                </span>
            </TableHead>
        </TableRow>
    );
}

/** Sticky so the slot stays readable while the week scrolls sideways on a narrow screen. */
function RowHeader({ title, capitalize = false }: { title: string; capitalize?: boolean }) {
    return (
        <TableHead
            scope="row"
            className={cn(
                "sticky start-0 z-10 h-auto bg-card py-2 align-top whitespace-normal",
                // role names are stored lowercase; every other screen shows them capitalized
                capitalize && "capitalize",
            )}
        >
            {title}
        </TableHead>
    );
}

export function ScheduleGrid({
    branchId,
    dates,
    today,
    periods,
    roleRows,
    openRegisterRows,
    hasRegisters,
    registerRoleIds,
    staff,
    slots,
}: {
    branchId: number;
    dates: string[];
    /** Server-computed, so the highlighted column can't differ between server and client render. */
    today: string;
    /** In schedule order; each becomes a group of rows. */
    periods: ShiftPeriodView[];
    roleRows: RoleRow[];
    openRegisterRows: OpenRegisterRow[];
    hasRegisters: boolean;
    /** Roles that get register choices; empty means nobody is on a register yet, so every role does. */
    registerRoleIds: number[];
    staff: StaffMember[];
    /** Everyone on each (date, period), keyed by slotKey — grouped once on the server. */
    slots: Record<string, SchedulePerson[]>;
}) {
    const layout = useLayout();
    const t = useT();
    const locale = useLocale();
    // Who is already booked in each slot, as a Set per slot — built once per data change, not per cell render.
    const busyBySlot = useMemo(
        () => new Map(Object.entries(slots).map(([key, people]) => [key, new Set(people.map((person) => person.userId))])),
        [slots],
    );
    const noOne = useMemo(() => new Set<number>(), []);

    const busyIn = (date: string, periodId: number) => busyBySlot.get(slotKey(date, periodId)) ?? noOne;
    const usesRegisters = (roleId: number) => registerRoleIds.length === 0 || registerRoleIds.includes(roleId);

    // Each period with its role rows; a period without any is left out. Both layouts below render from
    // this. The period's free registers aren't a row of their own: each cell's Add picker and register
    // tags offer them, and its "Needs" already says who is missing.
    const groups = periods.flatMap((period) => {
        const rows = roleRows.filter((row) => row.periodId === period.periodId);
        const openRow = hasRegisters ? openRegisterRows.find((row) => row.periodId === period.periodId) : undefined;
        return rows.length === 0 ? [] : [{ period, rows, openRow }];
    });

    const dayNeeds = dates.map((_, index) => groups.some(({ rows }) => rows.some((row) => row.cells[index].shortfall > 0)));

    const roleCell = (row: RoleRow, index: number, openRow: OpenRegisterRow | undefined) => (
        <RoleCellView
            branchId={branchId}
            row={row}
            cellIndex={index}
            staff={staff}
            busy={busyIn(row.cells[index].date, row.periodId)}
            openSeats={usesRegisters(row.roleId) ? openRow?.cells[index].open ?? [] : []}
        />
    );

    // Today's column carries a light tint top to bottom, so it stays findable deep in the grid; a slot
    // still needing someone says so with its own dot (NEEDS_DOT), not a fill.
    const dayCell = (date: string) => cn("align-top whitespace-normal", date === today && "bg-muted");

    return (
        <div>
            {/* Wide screens: the whole week at once. */}
            {layout !== "day" ? (<div className="hidden overflow-x-auto rounded-lg border border-border bg-card xl:block">
                {/* fixed layout: the seven days share the width evenly, so the whole week fits from `xl` without scrolling */}
                <Table className="table-fixed">
                    <TableCaption className="sr-only">
                        {t.schedule.gridCaption}
                    </TableCaption>
                    <colgroup>
                        <col className="w-28" />
                        {dates.map((date) => (
                            <col key={date} />
                        ))}
                    </colgroup>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead scope="col" className="sticky start-0 z-10 bg-card">{t.schedule.slot}</TableHead>
                            {dates.map((date) => (
                                <TableHead
                                    key={date}
                                    scope="col"
                                    aria-current={date === today ? "date" : undefined}
                                    className={cn("h-auto py-2 leading-tight whitespace-nowrap", date === today && "bg-muted font-semibold")}
                                >
                                    <DayHeading date={date} locale={locale} todayLabel={date === today ? t.common.today : undefined} />
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {groups.map(({ period, rows, openRow }) => (
                            <Fragment key={period.periodId}>
                                <PeriodRow period={period} colSpan={dates.length + 1} />
                                {rows.map((row) => (
                                    <TableRow key={`role-${row.roleId}-${row.periodId}`} className="hover:bg-transparent">
                                        <RowHeader title={row.roleName} capitalize />
                                        {row.cells.map((cell, index) => (
                                            <TableCell key={cell.date} className={dayCell(cell.date)}>
                                                {roleCell(row, index, openRow)}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </Fragment>
                        ))}
                    </TableBody>
                </Table>
            </div>) : null}

            {/* Phones and tablets: one day at a time, the same cells stacked in a single column. */}
            {layout !== "table" ? (<DayView dates={dates} today={today} dayNeeds={dayNeeds}>
                {(index) =>
                    groups.map(({ period, rows, openRow }) => (
                        <section key={period.periodId} aria-labelledby={`day-period-${period.periodId}`} className="flex flex-col gap-2">
                            <h4 id={`day-period-${period.periodId}`} className="flex items-baseline gap-2 text-sm font-semibold">
                                {period.name}
                                <PeriodHours period={period} />
                            </h4>
                            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                                {rows.map((row) => (
                                    <li
                                        key={row.roleId}
                                        className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 px-3 py-3"
                                    >
                                        <span className="pt-0.5 text-sm font-medium capitalize">{row.roleName}</span>
                                        {roleCell(row, index, openRow)}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))
                }
            </DayView>) : null}
        </div>
    );
}

/**
 * The narrow-screen schedule: a strip of the week's days, each marked when it still needs someone,
 * and the chosen day below. Opens on today when today is in this week. The choice is local state,
 * so it survives the refresh after each edit.
 */
function DayView({
    dates,
    today,
    dayNeeds,
    children,
}: {
    dates: string[];
    today: string;
    dayNeeds: boolean[];
    children: (index: number) => React.ReactNode;
}) {
    const [selected, setSelected] = useState(() => Math.max(0, dates.indexOf(today)));
    const t = useT();
    const locale = useLocale();

    return (
        <div className="flex flex-col gap-4 xl:hidden">
            <div role="group" aria-label={t.schedule.dayGroup} className="grid grid-cols-7 gap-1">
                {dates.map((date, index) => {
                    const { weekday, day } = formatDayStacked(date, locale);
                    const isSelected = index === selected;
                    return (
                        <button
                            key={date}
                            type="button"
                            aria-pressed={isSelected}
                            aria-label={t.schedule.dayButton(formatDay(date, locale), date === today, dayNeeds[index])}
                            onClick={() => setSelected(index)}
                            className={cn(
                                "relative flex min-h-12 flex-col items-center justify-center rounded-md border text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                                isSelected ? CHOSEN : "border-border bg-card text-foreground hover:bg-muted",
                                !isSelected && date === today && "border-foreground/40 bg-muted",
                            )}
                        >
                            <span className={cn(!isSelected && "text-muted-foreground")}>{weekday}</span>
                            <span className="text-sm font-medium tabular-nums">{day}</span>
                            {dayNeeds[index] ? (
                                <span aria-hidden="true" className={cn(NEEDS_DOT, "absolute top-1 end-1")} />
                            ) : null}
                        </button>
                    );
                })}
            </div>
            <h3 className="text-sm font-medium">
                {formatDay(dates[selected], locale)}
                {dates[selected] === today ? <span className="ms-2 text-xs font-normal text-muted-foreground">{t.common.today}</span> : null}
            </h3>
            {children(selected)}
        </div>
    );
}

/** What a copy did, in the manager's terms; the three outcomes need different next steps. */
function copyOutcome(created: number, skipped: number, sourceLabel: string, t: Dictionary): string {
    if (created === 0 && skipped === 0) return t.schedule.copyNothing(sourceLabel);
    if (created === 0) return t.schedule.copyNothingNew(skipped);
    return t.schedule.copied(created, skipped);
}

/** The page's one primary action: fills this week from the one before, after a confirmation, in a single request. */
export function CopyWeekButton({ branchId, weekStart }: { branchId: number; weekStart: string }) {
    const t = useT();
    const locale = useLocale();
    const sourceLabel = formatDay(addDays(weekStart, -7), locale);
    const router = useRouter();
    const [confirming, setConfirming] = useState(false);
    const [pending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

    function copy() {
        setMessage(null);
        startTransition(async () => {
            try {
                const { created, skipped } = await copyWeek(branchId, weekStart);
                setMessage({ text: copyOutcome(created, skipped, sourceLabel, t), isError: false });
                router.refresh();
            } catch (caught) {
                setMessage({ text: caught instanceof ApiError ? caught.message : t.schedule.copyFailed, isError: true });
            }
            setConfirming(false);
        });
    }

    return (
        <div className="flex flex-wrap items-center gap-3">
            <p role="status" className={cn("text-xs empty:hidden", message?.isError ? "text-destructive" : "text-muted-foreground")}>
                {message?.text}
            </p>
            <Button variant="outline" size="sm" onClick={() => setConfirming(true)} disabled={pending} className={TOUCH_HEIGHT}>
                {pending ? <Spinner data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
                {t.schedule.copyPrevious}
            </Button>
            <AlertDialog open={confirming} onOpenChange={setConfirming}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t.schedule.copyTitle(sourceLabel)}</AlertDialogTitle>
                        <AlertDialogDescription>{t.schedule.copyDescription}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={pending}>{t.common.cancel}</AlertDialogCancel>
                        <AlertDialogAction disabled={pending} onClick={copy}>
                            {pending ? <Spinner data-icon="inline-start" /> : null}
                            {t.schedule.copyShifts}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
