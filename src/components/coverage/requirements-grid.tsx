"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "@/lib/api-client";
import { createRequirement, updateRequirement } from "@/lib/api/coverage-requirements";
import { GridCell, GridRow, MAX_REQUIRED_COUNT, parseRequiredCount } from "@/lib/coverage-rows";
import { TOUCH_HEIGHT } from "@/lib/touch";
import { cn } from "@/lib/utils";

export interface GridPeriod {
    periodId: number;
    name: string;
    defaultStart: string;
    defaultEnd: string;
}

function RequirementCell({
    branchId,
    roleId,
    label,
    cell,
}: {
    branchId: number;
    roleId: number;
    label: string;
    cell: GridCell;
}) {
    const router = useRouter();
    const errorId = useId();
    const saved = cell.requiredCount === null ? "" : String(cell.requiredCount);
    const [value, setValue] = useState(saved);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    function save() {
        if (value.trim() === saved) return;

        // A requirement can't be deleted from here, so an emptied cell just goes back to its saved value.
        if (value.trim() === "") {
            setValue(saved);
            setError(null);
            return;
        }

        const count = parseRequiredCount(value);
        if (count === null) {
            setError(`Enter a whole number from 0 to ${MAX_REQUIRED_COUNT}.`);
            return;
        }

        setError(null);
        startTransition(async () => {
            try {
                if (cell.requirementId === null) {
                    await createRequirement({ branchId, roleId, periodId: cell.periodId, requiredCount: count });
                } else {
                    await updateRequirement(cell.requirementId, { requiredCount: count });
                }
                router.refresh();
            } catch (caught) {
                setValue(saved);
                setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
            }
        });
    }

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <Input
                    type="text"
                    inputMode="numeric"
                    value={value}
                    placeholder="–"
                    aria-label={label}
                    aria-invalid={error !== null || undefined}
                    aria-describedby={error ? errorId : undefined}
                    disabled={pending}
                    className={cn("w-16 tabular-nums", TOUCH_HEIGHT)}
                    onChange={(event) => setValue(event.target.value)}
                    onBlur={save}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                    }}
                />
                {pending ? <Spinner /> : null}
            </div>
            {error ? (
                <p id={errorId} role="alert" className="max-w-40 text-xs text-destructive">
                    {error}
                </p>
            ) : null}
        </div>
    );
}

export function RequirementsGrid({
    branchId,
    periods,
    rows,
}: {
    branchId: number;
    periods: GridPeriod[];
    rows: GridRow[];
}) {
    return (
        // As wide as its few short columns, not the page: each input stays next to its role name.
        <div className="w-fit max-w-full overflow-x-auto rounded-lg border border-border bg-card">
            <Table className="w-auto">
                <TableCaption className="sr-only">People required for each role in each shift period</TableCaption>
                <TableHeader>
                    <TableRow>
                        <TableHead scope="col">Role</TableHead>
                        {periods.map((period) => (
                            <TableHead key={period.periodId} scope="col" className="pr-8">
                                <div>{period.name}</div>
                                <div className="font-mono font-normal text-muted-foreground">
                                    {period.defaultStart}–{period.defaultEnd}
                                </div>
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={row.roleId}>
                            <TableHead scope="row">{row.roleName}</TableHead>
                            {row.cells.map((cell, index) => (
                                <TableCell key={cell.periodId}>
                                    <RequirementCell
                                        key={`${cell.requirementId}-${cell.requiredCount}`}
                                        branchId={branchId}
                                        roleId={row.roleId}
                                        label={`${row.roleName}, ${periods[index].name}: people required`}
                                        cell={cell}
                                    />
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
