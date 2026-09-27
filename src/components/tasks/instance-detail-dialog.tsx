"use client";

import type { ReactNode } from "react";
import { PhotoLink } from "@/components/tasks/photo-link";
import { StatusBadge } from "@/components/tasks/status-badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { InstanceRow } from "@/lib/instance-rows";

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
            <DialogContent className="sm:max-w-md">
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
                        <DetailField label="Assigned to">{row.assignee}</DetailField>
                        <DetailField label="Schedule">{row.schedule}</DetailField>
                        <DetailField label="Due">
                            <span className="font-mono">{row.dueDate}</span>
                        </DetailField>
                    </div>
                    {row.completedByName !== null ? (
                        <DetailField label="Completed by">
                            <span>{row.completedByName}</span>
                            {row.completedDate !== null ? (
                                <span className="text-muted-foreground"> on {row.completedDate}</span>
                            ) : null}
                            {row.photoMediaId !== null ? (
                                <>
                                    {" · "}
                                    <PhotoLink mediaId={row.photoMediaId} />
                                </>
                            ) : null}
                        </DetailField>
                    ) : null}
                    {row.reviewedByName !== null ? (
                        <DetailField label={row.status === "rejected" ? "Declined by" : "Approved by"}>
                            <span>{row.reviewedByName}</span>
                            {row.reviewedDate !== null ? (
                                <span className="text-muted-foreground"> on {row.reviewedDate}</span>
                            ) : null}
                        </DetailField>
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    );
}
