"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCogIcon, XIcon } from "lucide-react";
import { PeriodHours } from "@/components/schedule/period-hours";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { Dictionary } from "@/i18n/dictionaries";
import { useLocale, useT } from "@/i18n/client";
import { isolate } from "@/i18n/locales";
import { ApiError } from "@/lib/api-client";
import { approveSchedule, proposeSchedule } from "@/lib/api/schedule-builder";
import { countChanges, groupByDay, ProposalRow, shortReason, swapCandidates, toRows } from "@/lib/auto-fill-rows";
import { formatDay, formatDayStacked, formatWeekRange, weekDates } from "@/lib/coverage-rows";
import { NEEDS_DOT } from "@/lib/schedule-grid";
import { TOUCH_HEIGHT } from "@/lib/touch";
import { cn } from "@/lib/utils";
import { Role } from "@/types/role";
import { DEFAULT_MAX_SHIFTS_PER_WEEK, MAX_SHIFTS_PER_WEEK, ScheduleProposal, UnfilledSlot } from "@/types/schedule-builder";
import { ShiftPeriodView } from "@/types/shift-period";

function parseMaxShifts(value: string): number | null {
    const n = Number(value);
    return Number.isInteger(n) && n >= 1 && n <= MAX_SHIFTS_PER_WEEK ? n : null;
}

/**
 * The last approval's result. Approving can unmount the button that did it (an empty week turns
 * into the grid), so the button the refreshed page mounts for the same branch and week picks the
 * message up, if it's fresh.
 */
let lastApproval: { key: string; text: string; at: number } | null = null;
const APPROVAL_NOTICE_MS = 15_000;

function takeApproval(key: string): string | null {
    if (lastApproval === null || lastApproval.key !== key || Date.now() - lastApproval.at > APPROVAL_NOTICE_MS) return null;
    const { text } = lastApproval;
    lastApproval = null;
    return text;
}

/** What a confirm in the footer would throw away the edited proposal for. */
type Leaving = "close" | "restart";

/**
 * Asks the auto-scheduler for this week's open coverage, shows the suggestion to swap or trim,
 * and only Approve saves it. The proposal lives in this component's state; once the manager has
 * changed it, closing or starting over asks first, and a click outside doesn't close it.
 */
export function AutoFillButton({
    branchId,
    weekStart,
    periods,
    roles,
}: {
    branchId: number;
    weekStart: string;
    /** in the schedule's order */
    periods: ShiftPeriodView[];
    roles: Role[];
}) {
    const t = useT();
    const locale = useLocale();
    const router = useRouter();
    const key = `${branchId}:${weekStart}`;
    const [open, setOpen] = useState(false);
    const [maxShifts, setMaxShifts] = useState(String(DEFAULT_MAX_SHIFTS_PER_WEEK));
    const [maxInvalid, setMaxInvalid] = useState(false);
    const [proposal, setProposal] = useState<ScheduleProposal | null>(null);
    const [rows, setRows] = useState<ProposalRow[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(() => takeApproval(key));
    const [leaving, setLeaving] = useState<Leaving | null>(null);
    const [pending, startTransition] = useTransition();
    const changes = proposal === null ? 0 : countChanges(proposal, rows);

    function backToLimit() {
        setProposal(null);
        setRows([]);
        setError(null);
        setLeaving(null);
    }

    function close() {
        setOpen(false);
        backToLimit();
    }

    /** Leaves the review now, or asks first when the manager's edits would be lost. */
    function leave(intent: Leaving) {
        if (changes > 0) {
            setLeaving(intent);
        } else if (intent === "close") {
            close();
        } else {
            backToLimit();
        }
    }

    function handleOpenChange(next: boolean) {
        if (pending) return;
        if (next) {
            setOpen(true);
        } else if (leaving !== null) {
            // Esc with the confirm showing backs out of the confirm, not the dialog
            setLeaving(null);
        } else {
            leave("close");
        }
    }

    function run(action: () => Promise<void>) {
        setError(null);
        startTransition(async () => {
            try {
                await action();
            } catch (caught) {
                setError(caught instanceof ApiError ? caught.message : t.schedule.autoFillFailed);
            }
        });
    }

    function suggest(max: number) {
        run(async () => {
            const result = await proposeSchedule(branchId, weekStart, max);
            setProposal(result);
            setRows(toRows(result.assignments));
        });
    }

    function submitLimit() {
        const max = parseMaxShifts(maxShifts);
        setMaxInvalid(max === null);
        if (max !== null) suggest(max);
    }

    function tryLimit(max: number) {
        setMaxShifts(String(max));
        if (changes > 0) {
            setLeaving("restart");
        } else {
            suggest(max);
        }
    }

    function approve() {
        if (proposal === null) return;
        const { maxShiftsPerWeek } = proposal;
        run(async () => {
            const shifts = rows.map(({ userId, roleId, periodId, shiftDate }) => ({ userId, roleId, periodId, shiftDate }));
            const { created, skipped } = await approveSchedule(branchId, weekStart, maxShiftsPerWeek, shifts);
            const text = t.schedule.autoFilled(created, skipped);
            lastApproval = { key, text, at: Date.now() };
            setMessage(text);
            close();
            router.refresh();
        });
    }

    return (
        <div className="flex flex-wrap items-center gap-3">
            <p role="status" className="text-sm text-muted-foreground empty:hidden">
                {message}
            </p>
            <Dialog open={open} onOpenChange={handleOpenChange} disablePointerDismissal={proposal !== null}>
                <DialogTrigger render={<Button variant="outline" size="sm" className={TOUCH_HEIGHT} />}>
                    <CalendarCogIcon data-icon="inline-start" />
                    {t.schedule.autoFill}
                </DialogTrigger>
                {/* the review can outgrow a phone screen, so the dialog itself scrolls within it */}
                <DialogContent className={cn("max-h-[calc(100dvh-2rem)] grid-cols-[minmax(0,1fr)] overflow-x-hidden overflow-y-auto", proposal === null ? "sm:max-w-md" : "sm:max-w-3xl")}>
                    <DialogHeader>
                        <DialogTitle className="pe-8">{t.schedule.autoFillTitle(formatWeekRange(weekStart, locale))}</DialogTitle>
                        <DialogDescription>{t.schedule.autoFillDescription}</DialogDescription>
                    </DialogHeader>
                    {proposal === null ? (
                        <form
                            id="auto-fill-form"
                            noValidate
                            onSubmit={(event) => {
                                event.preventDefault();
                                submitLimit();
                            }}
                        >
                            <Field data-invalid={maxInvalid || undefined}>
                                <FieldLabel htmlFor="auto-fill-max">{t.schedule.maxShiftsLabel}</FieldLabel>
                                <Input
                                    id="auto-fill-max"
                                    type="number"
                                    inputMode="numeric"
                                    min={1}
                                    max={MAX_SHIFTS_PER_WEEK}
                                    value={maxShifts}
                                    disabled={pending}
                                    aria-invalid={maxInvalid || undefined}
                                    onChange={(event) => setMaxShifts(event.target.value)}
                                    // max-w, not w: Field's `*:w-full` outranks a plain width on its children
                                    className={cn("max-w-24 font-mono tabular-nums", TOUCH_HEIGHT)}
                                />
                                <FieldDescription>{t.schedule.maxShiftsHint}</FieldDescription>
                                <FieldError>{maxInvalid ? t.schedule.maxShiftsInvalid(MAX_SHIFTS_PER_WEEK) : null}</FieldError>
                            </Field>
                        </form>
                    ) : (
                        <ProposalPreview
                            branchId={branchId}
                            weekStart={weekStart}
                            proposal={proposal}
                            rows={rows}
                            setRows={setRows}
                            periods={periods}
                            roles={roles}
                            disabled={pending || leaving !== null}
                            onTryLimit={tryLimit}
                        />
                    )}
                    {error !== null ? (
                        <p role="alert" className="text-sm text-destructive">
                            {error}
                        </p>
                    ) : null}
                    <DialogFooter className="sm:items-center">
                        {leaving !== null ? (
                            <>
                                <p role="alert" className="text-sm font-medium sm:me-auto">
                                    {t.schedule.discardChanges(changes)}
                                </p>
                                <Button variant="outline" autoFocus className={TOUCH_HEIGHT} onClick={() => setLeaving(null)}>
                                    {t.schedule.keepEditing}
                                </Button>
                                <Button variant="destructive" className={TOUCH_HEIGHT} onClick={leaving === "close" ? close : backToLimit}>
                                    {t.schedule.discard}
                                </Button>
                            </>
                        ) : proposal === null ? (
                            <>
                                <DialogClose render={<Button variant="outline" className={TOUCH_HEIGHT} disabled={pending} />}>
                                    {t.common.cancel}
                                </DialogClose>
                                <Button type="submit" form="auto-fill-form" disabled={pending} className={TOUCH_HEIGHT}>
                                    {pending ? <Spinner data-icon="inline-start" /> : null}
                                    {t.schedule.suggest}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="ghost" disabled={pending} className={cn("sm:me-auto", TOUCH_HEIGHT)} onClick={() => leave("restart")}>
                                    {t.schedule.changeLimit}
                                </Button>
                                <DialogClose render={<Button variant="outline" className={TOUCH_HEIGHT} disabled={pending} />}>
                                    {rows.length === 0 ? t.common.close : t.common.cancel}
                                </DialogClose>
                                {rows.length > 0 ? (
                                    <Button onClick={approve} disabled={pending} className={TOUCH_HEIGHT}>
                                        {pending ? <Spinner data-icon="inline-start" /> : null}
                                        {t.schedule.approveShifts(rows.length)}
                                    </Button>
                                ) : null}
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function reasonText(t: Dictionary, reason: ReturnType<typeof shortReason>, role: string): string | null {
    switch (reason) {
        case null:
            return null;
        case "noRole":
        case "busy":
            return t.schedule.shortBecause[reason](role);
        default:
            return t.schedule.shortBecause[reason];
    }
}

/**
 * The suggestion: a day-by-period overview of what's suggested and what stays short, then each
 * day's rows, each person swappable or removable, and each short slot with why it's short.
 */
function ProposalPreview({
    branchId,
    weekStart,
    proposal,
    rows,
    setRows,
    periods,
    roles,
    disabled,
    onTryLimit,
}: {
    branchId: number;
    weekStart: string;
    proposal: ScheduleProposal;
    rows: ProposalRow[];
    setRows: (rows: ProposalRow[]) => void;
    periods: ShiftPeriodView[];
    roles: Role[];
    disabled: boolean;
    onTryLimit: (max: number) => void;
}) {
    const t = useT();
    const locale = useLocale();
    const days = groupByDay(rows, proposal.unfilled, periods);
    const roleName = (roleId: number) => roles.find((role) => role.roleId === roleId)?.name ?? "";
    const nameOf = (userId: number) => proposal.employees.find((employee) => employee.userId === userId)?.name ?? "";

    if (days.length === 0) {
        return <p className="text-sm text-muted-foreground">{t.schedule.autoFillNothingOpen}</p>;
    }

    const reasons = new Map(proposal.unfilled.map((slot) => [slot, shortReason(proposal, rows, slot)]));
    const stillShort = proposal.unfilled.reduce((sum, slot) => sum + slot.missing, 0);
    const capBound = [...reasons.values()].some((reason) => reason === "cap" || reason === "capOrRule");
    const ruleBound = [...reasons.values()].some((reason) => reason === "rule" || reason === "capOrRule");
    const higherLimit = proposal.maxShiftsPerWeek < MAX_SHIFTS_PER_WEEK ? proposal.maxShiftsPerWeek + 1 : null;

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-1.5">
                <p className="text-sm">
                    {rows.length > 0 ? t.schedule.proposalSummary(rows.length, stillShort) : t.schedule.autoFillNobody(stillShort)}
                </p>
                {(capBound && higherLimit !== null) || ruleBound ? (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        {capBound && higherLimit !== null ? (
                            <Button variant="link" className="h-auto p-0" disabled={disabled} onClick={() => onTryLimit(higherLimit)}>
                                {t.schedule.tryLimit(higherLimit)}
                            </Button>
                        ) : null}
                        {ruleBound ? (
                            <Link href={`/scheduling-rules?branch=${branchId}`} className="font-medium text-primary underline-offset-4 hover:underline">
                                {t.schedule.reviewRules}
                            </Link>
                        ) : null}
                    </div>
                ) : null}
            </div>
            <WeekOverview weekStart={weekStart} rows={rows} unfilled={proposal.unfilled} periods={periods} />
            <div className="-mx-1 grid gap-x-6 gap-y-4 px-1 md:max-h-[50vh] md:grid-cols-2 md:overflow-y-auto">
                {days.map((day) => (
                    <section key={day.date} className="flex min-w-0 flex-col gap-2">
                        <h3 className="text-sm font-semibold">{formatDay(day.date, locale)}</h3>
                        {day.periods.map(({ period, rows: periodRows, unfilled }) => (
                            <div key={period.periodId} className="flex flex-col gap-1.5">
                                <h4 className="flex items-baseline gap-2 text-xs font-medium text-muted-foreground">
                                    {period.name}
                                    <PeriodHours period={period} />
                                </h4>
                                {periodRows.length > 0 ? (
                                    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                                        {periodRows.map((row) => (
                                            <ProposalRowItem
                                                key={row.id}
                                                row={row}
                                                where={[isolate(roleName(row.roleId)), isolate(period.name), formatDay(row.shiftDate, locale)].join(t.common.listSeparator)}
                                                roleName={roleName(row.roleId)}
                                                name={nameOf(row.userId)}
                                                candidates={swapCandidates(proposal, rows, row)}
                                                disabled={disabled}
                                                onSwap={(userId) => setRows(rows.map((other) => (other.id === row.id ? { ...other, userId } : other)))}
                                                onRemove={() => setRows(rows.filter((other) => other.id !== row.id))}
                                            />
                                        ))}
                                    </ul>
                                ) : null}
                                {unfilled.map((slot) => {
                                    const because = reasonText(t, reasons.get(slot) ?? null, roleName(slot.roleId));
                                    return (
                                        <p key={slot.roleId} className="flex items-baseline gap-1.5 text-xs">
                                            <span aria-hidden="true" className={cn(NEEDS_DOT, "translate-y-[-1px]")} />
                                            <span>
                                                {t.schedule.stillShort(roleName(slot.roleId), slot.missing)}
                                                {because !== null ? (
                                                    <span className="text-muted-foreground">{t.common.listSeparator}{because}</span>
                                                ) : null}
                                            </span>
                                        </p>
                                    );
                                })}
                            </div>
                        ))}
                    </section>
                ))}
            </div>
        </div>
    );
}

/** The whole week at a glance, periods down and days across: how many suggested, how many still short. */
function WeekOverview({
    weekStart,
    rows,
    unfilled,
    periods,
}: {
    weekStart: string;
    rows: ProposalRow[];
    unfilled: UnfilledSlot[];
    periods: ShiftPeriodView[];
}) {
    const t = useT();
    const locale = useLocale();
    const dates = weekDates(weekStart);

    return (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-xs">
                <caption className="sr-only">{t.schedule.overview}</caption>
                <thead>
                    <tr className="border-b border-border">
                        <td />
                        {dates.map((date) => {
                            const { weekday, day } = formatDayStacked(date, locale);
                            return (
                                <th key={date} scope="col" className="px-2 py-1.5 text-center font-medium text-muted-foreground">
                                    <span className="block">{weekday}</span>
                                    <span className="block font-normal">{day}</span>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {periods.map((period) => (
                        <tr key={period.periodId} className="border-b border-border last:border-0">
                            <th scope="row" className="px-2 py-1.5 text-start font-medium whitespace-nowrap">
                                {period.name}
                            </th>
                            {dates.map((date) => {
                                const suggested = rows.filter((row) => row.shiftDate === date && row.periodId === period.periodId).length;
                                const short = unfilled
                                    .filter((slot) => slot.shiftDate === date && slot.periodId === period.periodId)
                                    .reduce((sum, slot) => sum + slot.missing, 0);
                                return (
                                    <td key={date} className="px-2 py-1.5 text-center font-mono tabular-nums">
                                        {suggested === 0 && short === 0 ? (
                                            <span aria-hidden="true" className="text-muted-foreground/60">·</span>
                                        ) : (
                                            <>
                                                <span aria-hidden="true" className="inline-flex items-center gap-1.5">
                                                    {suggested > 0 ? <span>+{suggested}</span> : null}
                                                    {short > 0 ? (
                                                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                                                            <span className={NEEDS_DOT} />
                                                            {short}
                                                        </span>
                                                    ) : null}
                                                </span>
                                                <span className="sr-only">{t.schedule.overviewCell(suggested, short)}</span>
                                            </>
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function ProposalRowItem({
    row,
    where,
    roleName,
    name,
    candidates,
    disabled,
    onSwap,
    onRemove,
}: {
    row: ProposalRow;
    where: string;
    roleName: string;
    name: string;
    candidates: ScheduleProposal["employees"];
    disabled: boolean;
    onSwap: (userId: number) => void;
    onRemove: () => void;
}) {
    const t = useT();

    return (
        <li className="flex items-center gap-2 px-2 py-1.5">
            {/* role names are stored lowercase; standing alone they're capitalized */}
            <span className="w-20 shrink-0 truncate text-xs capitalize text-muted-foreground">{roleName}</span>
            {candidates.length > 1 ? (
                <Select value={String(row.userId)} onValueChange={(value) => onSwap(Number(value))} disabled={disabled}>
                    <SelectTrigger size="sm" aria-label={t.schedule.changePerson(name, where)} className={cn("min-w-0 flex-1", TOUCH_HEIGHT)}>
                        <SelectValue>
                            {(value: string) => candidates.find((employee) => String(employee.userId) === value)?.name ?? name}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {candidates.map((employee) => (
                            <SelectItem key={employee.userId} value={String(employee.userId)}>
                                {employee.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            ) : (
                // nobody else could take it, so there's nothing to pick
                <bdi className="min-w-0 flex-1 truncate px-2.5 text-sm">{name}</bdi>
            )}
            <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t.schedule.removeFrom(name, where)}
                disabled={disabled}
                onClick={onRemove}
                className="[@media(pointer:coarse)]:size-11"
            >
                <XIcon />
            </Button>
        </li>
    );
}
