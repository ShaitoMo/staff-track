"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
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
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "@/lib/api-client";
import { copyWeek, createShift, deleteShift, setShiftRegister } from "@/lib/api/shifts";
import { addDays, formatDay } from "@/lib/coverage-rows";
import {
    NEEDS_TINT,
    OpenRegisterCell,
    OpenRegisterRow,
    RegisterSeat,
    RoleRow,
    SchedulePerson,
    SlotShift,
    StaffMember,
} from "@/lib/schedule-grid";
import { cn } from "@/lib/utils";
import { ShiftPeriodView } from "@/types/shift-period";

/** Touch screens get a full 44px tap target; mouse layouts keep the compact size. */
const touch = "[@media(pointer:coarse)]:h-11";

/** Runs one schedule edit, then refreshes the server data; keeps its own pending and error state per cell. */
function useScheduleAction() {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    function run(action: () => Promise<void>) {
        setError(null);
        startTransition(async () => {
            try {
                await action();
                router.refresh();
            } catch (caught) {
                setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
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
        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card py-0.5 pr-0.5 pl-2 text-xs">
            {person.name}
            {tag}
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
                    "-ml-1 gap-1 border-transparent px-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground data-popup-open:bg-muted data-popup-open:text-foreground [&>svg:last-child]:hidden",
                    touch,
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

    const options = [
        ...openSeats.map((seat) => ({ value: String(seat.registerId), name: seat.name })),
        ...(person.registerId === null ? [] : [{ value: NO_REGISTER, name: "No register" }]),
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
                    person.registerName ? `${person.name} is on ${person.registerName}; change register (${where})` : `Put ${person.name} on a register (${where})`
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
                        register
                    </>
                )}
            </SelectTrigger>
            <PickerOptions groups={[{ label: "Register", options }]} />
        </Select>
    );
}

function CellShell({ pending, error, children }: { pending: boolean; error: string | null; children: React.ReactNode }) {
    return (
        <div className="flex min-w-44 flex-col items-start gap-1.5">
            {children}
            {pending ? <Spinner /> : null}
            {error ? (
                <p role="alert" className="max-w-44 text-xs whitespace-normal text-destructive">
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
    const cell = row.cells[cellIndex];
    const where = `${row.roleName}, ${row.periodName}, ${formatDay(cell.date)}`;
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
                <span className="text-xs font-medium text-destructive">
                    Needs {cell.shortfall}
                    <span className="sr-only"> more of {cell.required}</span>
                </span>
            ) : null}
            {cell.people.map((person) => (
                <PersonChip
                    key={person.shiftId}
                    person={person}
                    label={`Remove ${person.name} from ${where}`}
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
                placeholder="Add"
                label={`Add a person to ${where}`}
                groups={[
                    ...openSeats.map((seat) => ({ label: `On ${seat.name}`, options: optionsFor(seat.registerId) })),
                    { label: "No register", options: optionsFor(null) },
                ]}
                disabled={pending}
                onPick={add}
            />
            {free.length === 0 && cell.shortfall > 0 ? (
                <span className="text-xs text-muted-foreground">No {row.roleName} free</span>
            ) : null}
        </CellShell>
    );
}

/**
 * The period's leftover register work: each register nobody is on, with a picker to fill it, and
 * any register holding more than one person, so the extra can be taken off.
 */
function OpenRegistersCellView({
    branchId,
    periodLabel,
    periodId,
    cell,
    staff,
    names,
    slot,
}: {
    branchId: number;
    periodLabel: string;
    periodId: number;
    cell: OpenRegisterCell;
    staff: StaffMember[];
    names: Map<number, string>;
    slot: SlotShift[];
}) {
    const { pending, error, run } = useScheduleAction();
    const day = formatDay(cell.date);
    const busy = new Set(slot.map((shift) => shift.userId));

    // Someone already working this period moves onto the register (a PATCH); anyone else gets a new shift.
    const onShift = slot
        .filter((shift) => shift.registerId === null && names.has(shift.userId))
        .map((shift) => ({ id: `shift:${shift.shiftId}`, name: names.get(shift.userId) ?? "" }));
    const others = staff.filter((member) => !busy.has(member.userId)).map((member) => ({ id: `user:${member.userId}`, name: member.name }));

    function assign(registerId: number, value: string) {
        const [kind, id] = value.split(":");
        run(() =>
            kind === "shift"
                ? setShiftRegister(Number(id), registerId)
                : createShift({ user_id: Number(id), branch_id: branchId, period_id: periodId, shift_date: cell.date, register_id: registerId }),
        );
    }

    return (
        <CellShell pending={pending} error={error}>
            {cell.open.map((seat) => (
                <div key={seat.registerId} className="flex flex-wrap items-center gap-x-1">
                    <span className="text-xs font-medium text-destructive">{seat.name}</span>
                    <PersonPicker
                        placeholder="Assign"
                        label={`Assign someone to ${seat.name}, ${periodLabel}, ${day}`}
                        groups={[
                            { label: "Already on shift", options: onShift.map((option) => ({ value: option.id, name: option.name })) },
                            { label: "Everyone else", options: others.map((option) => ({ value: option.id, name: option.name })) },
                        ]}
                        disabled={pending}
                        onPick={(value) => assign(seat.registerId, value)}
                    />
                </div>
            ))}
            {cell.crowded.map((register) => (
                <div key={register.registerId} className="flex flex-col items-start gap-1">
                    <span className="text-xs font-medium text-destructive">
                        {register.name} · {register.people.length} people
                    </span>
                    {register.people.map((person) => (
                        <PersonChip
                            key={person.shiftId}
                            person={person}
                            label={`Take ${person.name} off ${register.name}, ${periodLabel}, ${day}`}
                            disabled={pending}
                            onRemove={() => run(() => setShiftRegister(person.shiftId, null))}
                        />
                    ))}
                </div>
            ))}
        </CellShell>
    );
}

/** A period's heading row: its name and hours, spanning the week. */
function PeriodRow({ period, colSpan }: { period: ShiftPeriodView; colSpan: number }) {
    return (
        <TableRow className="hover:bg-transparent">
            <TableHead scope="colgroup" colSpan={colSpan} className="h-8 bg-muted/60 text-xs font-medium text-foreground">
                {period.name}
                <span className="ml-2 font-mono font-normal text-muted-foreground tabular-nums">
                    {period.defaultStart}–{period.defaultEnd}
                </span>
            </TableHead>
        </TableRow>
    );
}

/** Sticky so the slot stays readable while the week scrolls sideways on a narrow screen. */
function RowHeader({ title, muted = false }: { title: string; muted?: boolean }) {
    return (
        <TableHead
            scope="row"
            className={cn(
                "sticky left-0 z-10 h-auto w-28 bg-card py-2 align-top whitespace-normal sm:w-auto sm:whitespace-nowrap",
                muted && "text-xs font-normal text-muted-foreground",
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
    slotShifts,
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
    slotShifts: SlotShift[];
}) {
    // Who is already booked in each (date, period) — built once, read by every cell.
    const slots = useMemo(() => {
        const bySlot = new Map<string, SlotShift[]>();
        for (const shift of slotShifts) {
            const key = `${shift.date}:${shift.periodId}`;
            bySlot.set(key, [...(bySlot.get(key) ?? []), shift]);
        }
        return bySlot;
    }, [slotShifts]);
    const names = useMemo(() => new Map(staff.map((member) => [member.userId, member.name])), [staff]);

    const slotOf = (date: string, periodId: number) => slots.get(`${date}:${periodId}`) ?? [];
    const usesRegisters = (roleId: number) => registerRoleIds.length === 0 || registerRoleIds.includes(roleId);

    // Each period with its role rows and (when the branch has registers) its open-registers row;
    // periods with neither are left out. Both layouts below render from this.
    const groups = periods.flatMap((period) => {
        const rows = roleRows.filter((row) => row.periodId === period.periodId);
        const openRow = hasRegisters ? openRegisterRows.find((row) => row.periodId === period.periodId) : undefined;
        return rows.length === 0 && !openRow ? [] : [{ period, rows, openRow }];
    });

    const roleNeeds = (row: RoleRow, index: number) => row.cells[index].shortfall > 0;
    const openNeeds = (openRow: OpenRegisterRow, index: number) =>
        openRow.cells[index].open.length > 0 || openRow.cells[index].crowded.length > 0;
    const dayNeeds = dates.map((_, index) =>
        groups.some(({ rows, openRow }) => rows.some((row) => roleNeeds(row, index)) || (openRow !== undefined && openNeeds(openRow, index))),
    );

    const roleCell = (row: RoleRow, index: number, openRow: OpenRegisterRow | undefined) => (
        <RoleCellView
            branchId={branchId}
            row={row}
            cellIndex={index}
            staff={staff}
            busy={new Set(slotOf(row.cells[index].date, row.periodId).map((shift) => shift.userId))}
            openSeats={usesRegisters(row.roleId) ? openRow?.cells[index].open ?? [] : []}
        />
    );
    const openCell = (period: ShiftPeriodView, openRow: OpenRegisterRow, index: number) => (
        <OpenRegistersCellView
            branchId={branchId}
            periodLabel={period.name}
            periodId={period.periodId}
            cell={openRow.cells[index]}
            staff={staff}
            names={names}
            slot={slotOf(openRow.cells[index].date, period.periodId)}
        />
    );

    // A slot still needing someone is tinted (see the legend); otherwise today's column carries a
    // light tint top to bottom, so it stays findable deep in the grid.
    const dayCell = (date: string, needsSomeone: boolean) =>
        cn("align-top", needsSomeone ? NEEDS_TINT : date === today && "bg-muted");

    return (
        <div>
            {/* Wide screens: the whole week at once. */}
            <div className="hidden overflow-x-auto rounded-lg border border-border bg-card xl:block">
                <Table>
                    <TableCaption className="sr-only">
                        Weekly schedule by shift period: people per role, with the register each person works, and registers still open
                    </TableCaption>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead scope="col" className="sticky left-0 z-10 bg-card">Slot</TableHead>
                            {dates.map((date) => (
                                <TableHead
                                    key={date}
                                    scope="col"
                                    aria-current={date === today ? "date" : undefined}
                                    className={cn("whitespace-nowrap", date === today && "bg-muted font-semibold")}
                                >
                                    {formatDay(date)}
                                    {date === today ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">Today</span> : null}
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
                                        <RowHeader title={row.roleName} />
                                        {row.cells.map((cell, index) => (
                                            <TableCell key={cell.date} className={dayCell(cell.date, roleNeeds(row, index))}>
                                                {roleCell(row, index, openRow)}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                                {openRow ? (
                                    <TableRow className="hover:bg-transparent">
                                        <RowHeader title="Open registers" muted />
                                        {openRow.cells.map((cell, index) => (
                                            <TableCell key={cell.date} className={dayCell(cell.date, openNeeds(openRow, index))}>
                                                {openCell(period, openRow, index)}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ) : null}
                            </Fragment>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Phones and tablets: one day at a time, the same cells stacked in a single column. */}
            <DayView dates={dates} today={today} dayNeeds={dayNeeds}>
                {(index) =>
                    groups.map(({ period, rows, openRow }) => (
                        <section key={period.periodId} aria-labelledby={`day-period-${period.periodId}`} className="flex flex-col gap-2">
                            <h4 id={`day-period-${period.periodId}`} className="text-xs font-medium">
                                {period.name}
                                <span className="ml-2 font-mono font-normal text-muted-foreground tabular-nums">
                                    {period.defaultStart}–{period.defaultEnd}
                                </span>
                            </h4>
                            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                                {rows.map((row) => (
                                    <li
                                        key={row.roleId}
                                        className={cn("grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 px-3 py-3", roleNeeds(row, index) && NEEDS_TINT)}
                                    >
                                        <span className="pt-0.5 text-sm font-medium">{row.roleName}</span>
                                        {roleCell(row, index, openRow)}
                                    </li>
                                ))}
                                {openRow ? (
                                    <li className={cn("grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 px-3 py-3", openNeeds(openRow, index) && NEEDS_TINT)}>
                                        <span className="pt-0.5 text-xs text-muted-foreground">Open registers</span>
                                        {openNeeds(openRow, index) ? (
                                            openCell(period, openRow, index)
                                        ) : (
                                            <span className="pt-0.5 text-xs text-muted-foreground">All staffed</span>
                                        )}
                                    </li>
                                ) : null}
                            </ul>
                        </section>
                    ))
                }
            </DayView>
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

    return (
        <div className="flex flex-col gap-4 xl:hidden">
            <div role="group" aria-label="Day" className="grid grid-cols-7 gap-1">
                {dates.map((date, index) => {
                    const [weekday, day] = formatDay(date).split(" ");
                    const isSelected = index === selected;
                    return (
                        <button
                            key={date}
                            type="button"
                            aria-pressed={isSelected}
                            aria-label={`${formatDay(date)}${date === today ? ", today" : ""}${dayNeeds[index] ? ", needs people" : ""}`}
                            onClick={() => setSelected(index)}
                            className={cn(
                                "relative flex min-h-12 flex-col items-center justify-center rounded-md border text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                                isSelected ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground hover:bg-muted",
                                !isSelected && date === today && "border-foreground/40 bg-muted",
                            )}
                        >
                            <span className={cn(!isSelected && "text-muted-foreground")}>{weekday}</span>
                            <span className="text-sm font-medium tabular-nums">{day}</span>
                            {dayNeeds[index] ? (
                                <span aria-hidden="true" className="absolute top-1 right-1 size-1.5 rounded-full bg-destructive" />
                            ) : null}
                        </button>
                    );
                })}
            </div>
            <h3 className="text-sm font-medium">
                {formatDay(dates[selected])}
                {dates[selected] === today ? <span className="ml-2 text-xs font-normal text-muted-foreground">Today</span> : null}
            </h3>
            {children(selected)}
        </div>
    );
}

/** What a copy did, in the manager's terms; the three outcomes need different next steps. */
function copyOutcome(created: number, skipped: number, sourceLabel: string): string {
    if (created === 0 && skipped === 0) {
        return `Nothing to copy: the week of ${sourceLabel} has no shifts.`;
    }
    if (created === 0) {
        return `Nothing new copied: all ${skipped} shifts are already booked here or their people left the branch.`;
    }
    const copied = `Copied ${created} ${created === 1 ? "shift" : "shifts"}`;
    return skipped > 0 ? `${copied}; skipped ${skipped} already booked or no longer at the branch.` : `${copied}.`;
}

/** The page's one primary action: fills this week from the one before, after a confirmation, in a single request. */
export function CopyWeekButton({ branchId, weekStart }: { branchId: number; weekStart: string }) {
    const sourceLabel = formatDay(addDays(weekStart, -7));
    const router = useRouter();
    const [confirming, setConfirming] = useState(false);
    const [pending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

    function copy() {
        setMessage(null);
        startTransition(async () => {
            try {
                const { created, skipped } = await copyWeek(branchId, weekStart);
                setMessage({ text: copyOutcome(created, skipped, sourceLabel), isError: false });
                router.refresh();
            } catch (caught) {
                setMessage({ text: caught instanceof ApiError ? caught.message : "Couldn't copy the week. Try again.", isError: true });
            }
            setConfirming(false);
        });
    }

    return (
        <div className="flex flex-wrap items-center gap-3">
            <p role="status" className={cn("text-xs empty:hidden", message?.isError ? "text-destructive" : "text-muted-foreground")}>
                {message?.text}
            </p>
            <Button size="sm" onClick={() => setConfirming(true)} disabled={pending} className={touch}>
                {pending ? <Spinner data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
                Copy previous week
            </Button>
            <AlertDialog open={confirming} onOpenChange={setConfirming}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Copy the week of {sourceLabel}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Everyone scheduled that week gets the same shift seven days later. Shifts already in this week stay
                            as they are; anyone who would be double-booked, or has left the branch, is skipped.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction disabled={pending} onClick={copy}>
                            {pending ? <Spinner data-icon="inline-start" /> : null}
                            Copy shifts
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
