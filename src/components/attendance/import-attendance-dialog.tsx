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
import { useT } from "@/i18n/client";
import { ApiError } from "@/lib/api-client";
import { importAttendance } from "@/lib/api/attendance";
import { TOUCH_HEIGHT } from "@/lib/touch";
import type { ImportAttendanceResult } from "@/types/attendance-import";

/** What the upload did, then every row it couldn't use, so the manager can fix them in the file. */
function ImportOutcome({ result }: { result: ImportAttendanceResult }) {
    const t = useT();

    return (
        <div className="flex flex-col gap-2 text-sm" role="status">
            <p>{t.attendance.punchesAdded(result.records_created, result.records_skipped)}</p>
            {result.errors.length > 0 ? (
                <div className="flex flex-col gap-1">
                    <p className="text-destructive">{t.attendance.rowsFailed(result.errors.length)}</p>
                    <ul className="max-h-48 overflow-y-auto rounded-md border border-border px-3 py-2 text-xs">
                        {result.errors.map((error, index) => (
                            <li key={`${error.row}-${index}`}>
                                <span className="font-mono tabular-nums">{t.attendance.row(error.row)}</span>: {error.message}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}

/**
 * The clock machine's CSV/Excel export for this branch; each employee number is matched at this branch only.
 * `quiet` makes it an outline button, for when several branches are stacked on one page and a blue
 * one per branch would leave no single main action.
 */
export function ImportAttendanceDialog({ branchId, quiet = false }: { branchId: number; quiet?: boolean }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [result, setResult] = useState<ImportAttendanceResult | null>(null);
    const [pending, startTransition] = useTransition();
    const t = useT();

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
            setFileError(t.attendance.chooseFile);
            return;
        }

        startTransition(async () => {
            try {
                setResult(await importAttendance(branchId, file));
                router.refresh();
            } catch (error) {
                setSubmitError(error instanceof ApiError ? error.message : t.attendance.importFailed);
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger render={<Button size="sm" variant={quiet ? "outline" : "default"} className={TOUCH_HEIGHT} />}>
                <UploadIcon data-icon="inline-start" />
                {t.attendance.importFile}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t.attendance.importTitle}</DialogTitle>
                    <DialogDescription>{t.attendance.importDescription}</DialogDescription>
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
                                {t.attendance.importAnother}
                            </Button>
                            <Button onClick={() => setOpen(false)}>{t.attendance.done}</Button>
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
                            <FieldLabel htmlFor="attendance-file">{t.attendance.file}</FieldLabel>
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
                                {t.attendance.import}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
