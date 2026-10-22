"use client";

import type { ReactNode } from "react";
import { StatusBadge } from "@/components/tasks/status-badge";
import { TaskReferencePhotos } from "@/components/tasks/task-reference";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatDay } from "@/lib/coverage-rows";
import type { InstanceRow } from "@/lib/instance-rows";
import { cn } from "@/lib/utils";

function DetailField({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-sm">{children}</span>
        </div>
    );
}

/**
 * The row's title, everywhere it appears (table cell or card heading): pressing it opens the full
 * details in a modal. Plain text styling, not a coloured link — Market Blue stays reserved for the
 * one primary action per view (DESIGN.md), and there is one of these per row.
 */
export function InstanceDetailDialog({ row, titleClassName }: { row: InstanceRow; titleClassName?: string }) {
    const sideBySide = row.referenceName !== null && row.photoMediaId !== null;

    return (
        <Dialog>
            <DialogTrigger
                render={
                    <button
                        type="button"
                        className={`text-left font-medium underline-offset-2 hover:underline ${titleClassName ?? ""}`}
                    />
                }
            >
                {row.title}
            </DialogTrigger>
            <DialogContent className={sideBySide ? "sm:max-w-2xl" : "sm:max-w-md"}>
                <DialogHeader>
                    <div className="flex items-start justify-between gap-2 pr-6">
                        <DialogTitle>{row.title}</DialogTitle>
                        <StatusBadge status={row.status} />
                    </div>
                </DialogHeader>
                <div className="flex flex-col gap-3">
                    {row.description !== null ? <DetailField label="Description">{row.description}</DetailField> : null}
                    <div className="grid grid-cols-2 gap-3">
                        <DetailField label="Branch">{row.branchName}</DetailField>
                        <DetailField label="Assigned to"><span className="capitalize">{row.assignee}</span></DetailField>
                        <DetailField label="Schedule">{row.schedule}</DetailField>
                        <DetailField label="Due">
                            {formatDay(row.dueDate)}
                        </DetailField>
                    </div>
                    {row.completedByName !== null ? (
                        <DetailField label="Completed by">
                            <span>{row.completedByName}</span>
                            {row.completedDate !== null ? (
                                <span className="text-muted-foreground"> on {formatDay(row.completedDate)}</span>
                            ) : null}
                        </DetailField>
                    ) : null}
                    {row.referenceName !== null || row.photoMediaId !== null ? (
                        // side by side when both are there, so a reviewer compares rather than remembers
                        <div className={cn("grid gap-3", sideBySide && "sm:grid-cols-2")}>
                            {row.referenceName !== null ? (
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-muted-foreground">How it should look · {row.referenceName}</span>
                                    <TaskReferencePhotos instanceId={row.instanceId} className={sideBySide ? "sm:grid-cols-2" : undefined} />
                                </div>
                            ) : null}
                            {row.photoMediaId !== null ? (
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-muted-foreground">Their photo</span>
                                    <a href={`/api/media/${row.photoMediaId}/file`} target="_blank" rel="noreferrer" aria-label="Open their photo">
                                        {/* eslint-disable-next-line @next/next/no-img-element -- a signed-URL redirect behind the session; next/image would fetch without the cookie */}
                                        <img
                                            src={`/api/media/${row.photoMediaId}/file`}
                                            alt=""
                                            className="aspect-[4/3] w-full rounded-lg border border-border bg-muted object-cover"
                                        />
                                    </a>
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                    {row.reviewedByName !== null ? (
                        <DetailField label={row.status === "rejected" ? "Declined by" : "Approved by"}>
                            <span>{row.reviewedByName}</span>
                            {row.reviewedDate !== null ? (
                                <span className="text-muted-foreground"> on {formatDay(row.reviewedDate)}</span>
                            ) : null}
                        </DetailField>
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    );
}
