"use client";

import { useState, useTransition, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, UploadIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api-client";
import { importAttendance } from "@/lib/api/attendance";
import { TOUCH_HEIGHT } from "@/lib/touch";
import type { ImportAttendanceResult } from "@/types/attendance-import";

function plural(count: number, one: string, many: string): string {
    return `${count} ${count === 1 ? one : many}`;
}

/** What the upload did, then every row it couldn't use, so the manager can fix them in the file. */
function ImportOutcome({ result }: { result: ImportAttendanceResult }) {
    return (
        <div className="flex flex-col gap-2 text-sm" role="status">
            <p>
                {plural(result.records_created, "punch", "punches")} added
                {result.records_skipped > 0 ? `, ${result.records_skipped} already recorded` : ""}.
            </p>
            {result.errors.length > 0 ? (
                <div className="flex flex-col gap-1">
                    <p className="text-destructive">{plural(result.errors.length, "row", "rows")} could not be imported:</p>
                    <ul className="max-h-48 overflow-y-auto rounded-md border border-border px-3 py-2 text-xs">
                        {result.errors.map((error, index) => (
                            <li key={`${error.row}-${index}`}>
                                <span className="font-mono tabular-nums">Row {error.row}</span>: {error.message}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}

/** The clock machine's CSV/Excel export for this branch; each employee number is matched at this branch only. */
export function ImportAttendanceDialog({ branchId }: { branchId: number }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [result, setResult] = useState<ImportAttendanceResult | null>(null);
    const [pending, startTransition] = useTransition();

    function handleOpenChange(next: boolean) {
        if (pending) return;
        if (next) {
            setFile(null);
            setFileError(null);
            setSubmitError(null);
            setResult(null);
        }
        setOpen(next);
    }

    function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitError(null);

        if (file === null) {
            setFileError("Choose a file to import.");
            return;
        }

        startTransition(async () => {
            try {
                setResult(await importAttendance(branchId, file));
                router.refresh();
            } catch (error) {
                setSubmitError(error instanceof ApiError ? error.message : "Couldn't import the file. Try again.");
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger render={<Button size="sm" className={TOUCH_HEIGHT} />}>
                <UploadIcon data-icon="inline-start" />
                Import file
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Import attendance</DialogTitle>
                    <DialogDescription>
                        Upload the clock machine&apos;s export (.csv, .xls or .xlsx). Punches already recorded are skipped, so the same
                        file can be imported twice safely.
                    </DialogDescription>
                </DialogHeader>
                {result !== null ? (
                    <>
                        <ImportOutcome result={result} />
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    // the file input remounts empty, so the chosen file must go too
                                    setFile(null);
                                    setResult(null);
                                }}
                            >
                                Import another
                            </Button>
                            <Button onClick={() => setOpen(false)}>Done</Button>
                        </DialogFooter>
                    </>
                ) : (
                    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                        {submitError !== null ? (
                            <Alert variant="destructive">
                                <AlertCircleIcon />
                                <AlertDescription>{submitError}</AlertDescription>
                            </Alert>
                        ) : null}
                        <Field data-invalid={fileError !== null || undefined}>
                            <FieldLabel htmlFor="attendance-file">File</FieldLabel>
                            <Input
                                id="attendance-file"
                                type="file"
                                accept=".csv,.xls,.xlsx"
                                disabled={pending}
                                onChange={(event) => {
                                    setFile(event.target.files?.[0] ?? null);
                                    setFileError(null);
                                }}
                            />
                            <FieldError>{fileError}</FieldError>
                        </Field>
                        <DialogFooter>
                            <Button type="submit" disabled={pending}>
                                {pending ? <Spinner data-icon="inline-start" /> : null}
                                Import
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
