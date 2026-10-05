"use client";

import { useState, useTransition, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api-client";
import { updateAttendance } from "@/lib/api/attendance";
import { fixTimeToIso, type MissingEnd } from "@/lib/attendance-rows";
import { formatDay } from "@/lib/coverage-rows";
import { TOUCH_HEIGHT } from "@/lib/touch";

const END_LABELS: Record<MissingEnd, string> = { clock_in: "Clock-in time", clock_out: "Clock-out time" };

/** Enters the clock-in or clock-out the machine missed, on the branch's wall clock. */
export function FixPunchDialog({
    attendanceId,
    end,
    name,
    shiftDate,
    scheduledStart,
}: {
    attendanceId: number;
    end: MissingEnd;
    name: string;
    shiftDate: string;
    scheduledStart: string;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [time, setTime] = useState("");
    const [timeError, setTimeError] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const inputId = `fix-${attendanceId}`;

    function handleOpenChange(next: boolean) {
        if (pending) return;
        if (next) {
            setTime("");
            setTimeError(null);
            setSubmitError(null);
        }
        setOpen(next);
    }

    function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitError(null);

        if (time === "") {
            setTimeError("Enter a time.");
            return;
        }

        startTransition(async () => {
            try {
                await updateAttendance(attendanceId, { [end]: fixTimeToIso(shiftDate, scheduledStart, time, end) });
                setOpen(false);
                router.refresh();
            } catch (error) {
                setSubmitError(error instanceof ApiError ? error.message : "Couldn't save the punch. Try again.");
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger render={<Button size="xs" variant="outline" className={TOUCH_HEIGHT} />}>Fix</DialogTrigger>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>{end === "clock_in" ? "Add the missing clock-in" : "Add the missing clock-out"}</DialogTitle>
                    <DialogDescription>
                        {name}, {formatDay(shiftDate)}. Branch local time
                        {end === "clock_out" ? "; a time before the shift's start counts as the next morning." : "."}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                    {submitError !== null ? (
                        <Alert variant="destructive">
                            <AlertCircleIcon />
                            <AlertDescription>{submitError}</AlertDescription>
                        </Alert>
                    ) : null}
                    <Field data-invalid={timeError !== null || undefined}>
                        <FieldLabel htmlFor={inputId}>{END_LABELS[end]}</FieldLabel>
                        <Input
                            id={inputId}
                            type="time"
                            value={time}
                            disabled={pending}
                            onChange={(event) => {
                                setTime(event.target.value);
                                setTimeError(null);
                            }}
                        />
                        <FieldError>{timeError}</FieldError>
                    </Field>
                    <DialogFooter>
                        <Button type="submit" disabled={pending}>
                            {pending ? <Spinner data-icon="inline-start" /> : null}
                            Save
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
