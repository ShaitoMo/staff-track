"use client";

import { useState, useTransition, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, PlusIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/i18n/client";
import { ApiError } from "@/lib/api-client";
import { createAttendance } from "@/lib/api/attendance";
import { punchToIso } from "@/lib/attendance-rows";
import { TOUCH_HEIGHT } from "@/lib/touch";

interface PunchErrors {
    userId?: string;
    date?: string;
    clockIn?: string;
}

/**
 * A clock-in the machine missed. Times are the branch's wall clock; an earlier clock-out means the
 * next morning. With a `preset` it is a no-show row's own action: a small trigger, and the form
 * opens on that person, day and scheduled start.
 */
export function AddPunchDialog({
    branchId,
    staff,
    defaultDate,
    preset,
}: {
    branchId: number;
    staff: { userId: number; name: string }[];
    /** The day the form opens on without a preset: today in the current week, else the week's Monday. */
    defaultDate: string;
    preset?: { userId: number; date: string; clockIn: string; label: string };
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [userId, setUserId] = useState<number | null>(null);
    const [date, setDate] = useState(defaultDate);
    const [clockIn, setClockIn] = useState("");
    const [clockOut, setClockOut] = useState("");
    const [errors, setErrors] = useState<PunchErrors>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const t = useT();

    function handleOpenChange(next: boolean) {
        if (pending) return;
        if (next) {
            setUserId(preset?.userId ?? null);
            setDate(preset?.date ?? defaultDate);
            setClockIn(preset?.clockIn ?? "");
            setClockOut("");
            setErrors({});
            setSubmitError(null);
        }
        setOpen(next);
    }

    function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitError(null);

        const nextErrors: PunchErrors = {
            userId: userId === null ? t.attendance.choosePerson : undefined,
            date: date === "" ? t.attendance.enterDate : undefined,
            clockIn: clockIn === "" ? t.attendance.enterClockIn : undefined,
        };
        setErrors(nextErrors);
        if (userId === null || nextErrors.date || nextErrors.clockIn) return;

        startTransition(async () => {
            try {
                await createAttendance({ user_id: userId, branch_id: branchId, ...punchToIso(date, clockIn, clockOut) });
                setOpen(false);
                router.refresh();
            } catch (error) {
                setSubmitError(
                    error instanceof ApiError && error.status === 409
                        ? t.attendance.alreadyRecorded
                        : error instanceof ApiError
                          ? error.message
                          : t.attendance.addFailed,
                );
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            {preset ? (
                <DialogTrigger render={<Button size="xs" variant="outline" className={TOUCH_HEIGHT} aria-label={preset.label} />}>
                    {t.attendance.addPunch}
                </DialogTrigger>
            ) : (
                <DialogTrigger render={<Button size="sm" variant="outline" className={TOUCH_HEIGHT} disabled={staff.length === 0} />}>
                    <PlusIcon data-icon="inline-start" />
                    {t.attendance.addPunch}
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t.attendance.addPunchTitle}</DialogTitle>
                    <DialogDescription>{t.attendance.addPunchDescription}</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                    <FieldGroup>
                        {submitError !== null ? (
                            <Alert variant="destructive">
                                <AlertCircleIcon />
                                <AlertDescription>{submitError}</AlertDescription>
                            </Alert>
                        ) : null}
                        <Field data-invalid={!!errors.userId || undefined}>
                            <FieldLabel htmlFor="punch-person">{t.attendance.person}</FieldLabel>
                            <Select
                                value={userId !== null ? String(userId) : ""}
                                onValueChange={(value) => setUserId(Number(value))}
                                disabled={pending}
                            >
                                <SelectTrigger id="punch-person" className="w-full">
                                    <SelectValue placeholder={t.attendance.selectPerson}>
                                        {(value: string) =>
                                            staff.find((person) => String(person.userId) === value)?.name ?? t.attendance.selectPerson
                                        }
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {staff.map((person) => (
                                        <SelectItem key={person.userId} value={String(person.userId)}>
                                            {person.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FieldError>{errors.userId}</FieldError>
                        </Field>
                        <Field data-invalid={!!errors.date || undefined}>
                            <FieldLabel htmlFor="punch-date">{t.attendance.date}</FieldLabel>
                            <Input id="punch-date" type="date" value={date} disabled={pending} onChange={(e) => setDate(e.target.value)} />
                            <FieldError>{errors.date}</FieldError>
                        </Field>
                        <div className="grid grid-cols-2 gap-4">
                            <Field data-invalid={!!errors.clockIn || undefined}>
                                <FieldLabel htmlFor="punch-in">{t.attendance.clockIn}</FieldLabel>
                                <Input id="punch-in" type="time" value={clockIn} disabled={pending} onChange={(e) => setClockIn(e.target.value)} />
                                <FieldError>{errors.clockIn}</FieldError>
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="punch-out">{t.attendance.clockOut}</FieldLabel>
                                <Input id="punch-out" type="time" value={clockOut} disabled={pending} onChange={(e) => setClockOut(e.target.value)} />
                                <FieldDescription>{t.attendance.optional}</FieldDescription>
                            </Field>
                        </div>
                    </FieldGroup>
                    <DialogFooter>
                        <Button type="submit" disabled={pending}>
                            {pending ? <Spinner data-icon="inline-start" /> : null}
                            {t.attendance.addPunch}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
