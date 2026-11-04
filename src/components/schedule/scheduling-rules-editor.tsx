"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, XIcon } from "lucide-react";
import { FormAlerts, FormCard, FormFooter, FormSection } from "@/components/layout/form-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useT } from "@/i18n/client";
import { ApiError } from "@/lib/api-client";
import { saveScheduleRules } from "@/lib/api/schedule-builder";
import type { ScheduleRules } from "@/types/schedule-builder";

interface Person {
    userId: number;
    name: string;
    isActive: boolean;
    role: string;
}

type Pair = ScheduleRules["keepApart"][number];

const samePair = ([a, b]: Pair, [c, d]: Pair) => (a === c && b === d) || (a === d && b === c);

/** The rule set as one comparable string, ignoring the order pairs and periods were added in. */
function snapshot(pairs: Pair[], limits: Map<number, number[]>): string {
    return JSON.stringify([
        pairs.map(([a, b]) => (a < b ? `${a}:${b}` : `${b}:${a}`)).toSorted(),
        [...limits].map(([userId, periodIds]) => [userId, periodIds.toSorted((x, y) => x - y)]).toSorted(([x], [y]) => Number(x) - Number(y)),
    ]);
}

/**
 * A branch's two kinds of rule, edited together and saved in one go: pairs Auto-fill keeps apart,
 * and the periods each person may get. Saving replaces the branch's whole rule set. Pickers offer
 * active people only; a rule naming someone since made inactive stays listed and saved until removed.
 */
export function SchedulingRulesEditor({
    branchId,
    initial,
    people,
    periods,
}: {
    branchId: number;
    initial: ScheduleRules;
    /** everyone linked to the branch, sorted by name */
    people: Person[];
    /** the branch's periods that are on, in schedule order */
    periods: { periodId: number; name: string }[];
}) {
    const t = useT();
    const router = useRouter();
    const [pairs, setPairs] = useState<Pair[]>(initial.keepApart);
    const [limits, setLimits] = useState<Map<number, number[]>>(
        () => new Map(initial.periodLimits.map(({ userId, periodIds }) => [userId, periodIds])),
    );
    const [first, setFirst] = useState("");
    const [second, setSecond] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const [savedSnapshot, setSavedSnapshot] = useState(() =>
        snapshot(initial.keepApart, new Map(initial.periodLimits.map(({ userId, periodIds }) => [userId, periodIds]))),
    );
    const current = snapshot(pairs, limits);
    const dirty = current !== savedSnapshot;

    // a reload or closed tab would lose edits that only live here; in-app links don't fire this
    useEffect(() => {
        if (!dirty) return;
        const warn = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);

    const nameOf = (userId: number) => people.find((person) => person.userId === userId)?.name ?? `#${userId}`;
    const active = people.filter((person) => person.isActive);
    // inactive people stay in the limits table only while they still have a limit to clear
    const limitRows = people.filter((person) => person.isActive || limits.has(person.userId));
    const picked: Pair = [Number(first), Number(second)];
    const canAdd = first !== "" && second !== "" && !pairs.some((existing) => samePair(existing, picked));

    function addPair() {
        setPairs([...pairs, picked]);
        setFirst("");
        setSecond("");
        setMessage(null);
    }

    function togglePeriod(userId: number, periodId: number, on: boolean) {
        const current = limits.get(userId) ?? [];
        const next = on ? [...current, periodId] : current.filter((id) => id !== periodId);
        const updated = new Map(limits);
        if (next.length > 0) {
            updated.set(userId, next);
        } else {
            updated.delete(userId);
        }
        setLimits(updated);
        setMessage(null);
    }

    function save(event: React.FormEvent) {
        event.preventDefault();
        setError(null);
        setMessage(null);
        startTransition(async () => {
            try {
                await saveScheduleRules({
                    branchId,
                    keepApart: pairs,
                    periodLimits: [...limits].map(([userId, periodIds]) => ({ userId, periodIds })),
                });
                setSavedSnapshot(current);
                setMessage(t.schedulingRules.saved);
                router.refresh();
            } catch (caught) {
                setError(caught instanceof ApiError ? caught.message : t.common.somethingWentWrong);
            }
        });
    }

    return (
        <FormCard className="max-w-4xl" onSubmit={save}>
            {(error || message) && (
                <FormAlerts>
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircleIcon />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
                </FormAlerts>
            )}

            <FormSection legend={t.schedulingRules.keepApart} className="gap-y-4">
                <p className="text-sm text-muted-foreground">{t.schedulingRules.keepApartHint}</p>
                {pairs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t.schedulingRules.noPairs}</p>
                ) : (
                    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                        {pairs.map((pair) => {
                            const [a, b] = pair.map(nameOf);
                            return (
                                <li key={pair.join(":")} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
                                    <span>
                                        <bdi>{a}</bdi>
                                        <span aria-hidden="true" className="mx-2 text-muted-foreground">·</span>
                                        <bdi>{b}</bdi>
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        disabled={pending}
                                        aria-label={t.schedulingRules.removePair(a, b)}
                                        onClick={() => {
                                            setPairs(pairs.filter((existing) => !samePair(existing, pair)));
                                            setMessage(null);
                                        }}
                                    >
                                        <XIcon />
                                    </Button>
                                </li>
                            );
                        })}
                    </ul>
                )}

                <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <PersonPicker
                        id="keep-apart-first"
                        label={t.schedulingRules.firstPerson}
                        value={first}
                        options={active.filter((person) => String(person.userId) !== second)}
                        disabled={pending}
                        onChange={setFirst}
                    />
                    <PersonPicker
                        id="keep-apart-second"
                        label={t.schedulingRules.secondPerson}
                        value={second}
                        options={active.filter((person) => String(person.userId) !== first)}
                        disabled={pending}
                        onChange={setSecond}
                    />
                    {/* a pair already listed (either way round) can't be added twice */}
                    <Button type="button" variant="outline" disabled={pending || !canAdd} onClick={addPair}>
                        {t.schedulingRules.addPair}
                    </Button>
                </div>
            </FormSection>

            <FormSection legend={t.schedulingRules.onlyPeriods} className="gap-y-4">
                <p className="text-sm text-muted-foreground">{t.schedulingRules.onlyPeriodsHint}</p>
                {limitRows.length === 0 || periods.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        {limitRows.length === 0 ? t.schedulingRules.noPeople : t.schedulingRules.noPeriods}
                    </p>
                ) : (
                    <div className="rounded-lg border border-border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t.setup.name}</TableHead>
                                    <TableHead>{t.users.role}</TableHead>
                                    {periods.map((period) => (
                                        <TableHead key={period.periodId} className="text-center">
                                            <bdi>{period.name}</bdi>
                                        </TableHead>
                                    ))}
                                    <TableHead>{t.schedulingRules.canWork}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {limitRows.map((person) => {
                                    const allowed = limits.get(person.userId) ?? [];
                                    return (
                                        <TableRow key={person.userId}>
                                            <TableCell>
                                                <bdi className={person.isActive ? undefined : "text-muted-foreground"}>{person.name}</bdi>
                                            </TableCell>
                                            {/* role names are stored lowercase; standing alone they're capitalized */}
                                            <TableCell className="text-muted-foreground capitalize">{person.role}</TableCell>
                                            {periods.map((period) => (
                                                <TableCell key={period.periodId}>
                                                    <div className="flex justify-center">
                                                        <Checkbox
                                                            checked={allowed.includes(period.periodId)}
                                                            disabled={pending}
                                                            aria-label={t.schedulingRules.periodFor(period.name, person.name)}
                                                            onCheckedChange={(checked) =>
                                                                togglePeriod(person.userId, period.periodId, checked === true)}
                                                        />
                                                    </div>
                                                </TableCell>
                                            ))}
                                            {allowed.length === 0 ? (
                                                <TableCell className="text-muted-foreground">{t.schedulingRules.anyPeriod}</TableCell>
                                            ) : (
                                                <TableCell className="font-medium">
                                                    {t.schedulingRules.only(
                                                        periods.filter((period) => allowed.includes(period.periodId)).map((period) => period.name),
                                                    )}
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </FormSection>

            <FormFooter>
                <p role="status" className="me-auto self-center text-sm text-muted-foreground">
                    {dirty ? t.schedulingRules.unsaved : null}
                </p>
                <Button type="submit" disabled={pending}>
                    {pending && <Spinner data-icon="inline-start" />}
                    {t.schedulingRules.save}
                </Button>
            </FormFooter>
        </FormCard>
    );
}

function PersonPicker({
    id,
    label,
    value,
    options,
    disabled,
    onChange,
}: {
    id: string;
    label: string;
    value: string;
    options: Person[];
    disabled: boolean;
    onChange: (value: string) => void;
}) {
    const t = useT();

    return (
        <Field>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <Select value={value} onValueChange={(next) => onChange(String(next ?? ""))} disabled={disabled}>
                <SelectTrigger id={id} className="w-full">
                    <SelectValue placeholder={t.schedulingRules.choosePerson}>
                        {(selected: string) =>
                            options.find((person) => String(person.userId) === selected)?.name ?? t.schedulingRules.choosePerson}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {options.map((person) => (
                        <SelectItem key={person.userId} value={String(person.userId)}>
                            {person.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </Field>
    );
}
