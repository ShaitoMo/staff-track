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
import { ApiError } from "@/lib/api-client";
import { createAttendance } from "@/lib/api/attendance";
import { punchToIso } from "@/lib/attendance-rows";
import { TOUCH_HEIGHT } from "@/lib/touch";

interface PunchErrors {
    userId?: string;
    date?: string;
    clockIn?: string;
}

/** A clock-in the machine missed. Times are the branch's wall clock; an earlier clock-out means the next morning. */
export function AddPunchDialog({
    branchId,
    staff,
    defaultDate,
}: {
    branchId: number;
    staff: { userId: number; name: string }[];
    defaultDate: string;
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

    function handleOpenChange(next: boolean) {
        if (pending) return;
        if (next) {
            setUserId(null);
            setDate(defaultDate);
            setClockIn("");
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
            userId: userId === null ? "Choose a person." : undefined,
            date: date === "" ? "Enter a date." : undefined,
            clockIn: clockIn === "" ? "Enter a clock-in time." : undefined,
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
                        ? "This punch is already recorded for that person."
                        : error instanceof ApiError
                          ? error.message
                          : "Couldn't add the punch. Try again.",
                );
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger render={<Button size="sm" variant="outline" className={TOUCH_HEIGHT} disabled={staff.length === 0} />}>
                <PlusIcon data-icon="inline-start" />
                Add punch
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add a punch</DialogTitle>
                    <DialogDescription>For a clock-in the machine missed. Times are the branch&apos;s local time.</DialogDescription>
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
                            <FieldLabel htmlFor="punch-person">Person</FieldLabel>
                            <Select
                                value={userId !== null ? String(userId) : ""}
                                onValueChange={(value) => setUserId(Number(value))}
                                disabled={pending}
                            >
                                <SelectTrigger id="punch-person" className="w-full">
                                    <SelectValue placeholder="Select a person">
                                        {(value: string) =>
                                            staff.find((person) => String(person.userId) === value)?.name ?? "Select a person"
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
                            <FieldLabel htmlFor="punch-date">Date</FieldLabel>
                            <Input id="punch-date" type="date" value={date} disabled={pending} onChange={(e) => setDate(e.target.value)} />
                            <FieldError>{errors.date}</FieldError>
                        </Field>
                        <div className="grid grid-cols-2 gap-4">
                            <Field data-invalid={!!errors.clockIn || undefined}>
                                <FieldLabel htmlFor="punch-in">Clock in</FieldLabel>
                                <Input id="punch-in" type="time" value={clockIn} disabled={pending} onChange={(e) => setClockIn(e.target.value)} />
                                <FieldError>{errors.clockIn}</FieldError>
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="punch-out">Clock out</FieldLabel>
                                <Input id="punch-out" type="time" value={clockOut} disabled={pending} onChange={(e) => setClockOut(e.target.value)} />
                                <FieldDescription>Optional</FieldDescription>
                            </Field>
                        </div>
                    </FieldGroup>
                    <DialogFooter>
                        <Button type="submit" disabled={pending}>
                            {pending ? <Spinner data-icon="inline-start" /> : null}
                            Add punch
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
