import Link from "next/link";
import { AlertCircleIcon } from "lucide-react";
import { RequirementsGrid } from "@/components/coverage/requirements-grid";
import { WeeklyCoverage } from "@/components/coverage/weekly-coverage";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import {
    addDays,
    buildRequirementGrid,
    buildWeeklyCoverage,
    formatDay,
    sortPeriods,
} from "@/lib/coverage-rows";
import { CoverageGapRow } from "@/types/coverage-gap";
import { CoverageRequirementView } from "@/types/coverage-requirement";
import { Role } from "@/types/role";
import { ShiftPeriodView } from "@/types/shift-period";

function weekHref(branchId: number, weekStart: string): string {
    return `/roles?${new URLSearchParams({ branch: String(branchId), week: weekStart })}`;
}

export async function CoverageSection({
    branchId,
    weekStart,
    roles,
}: {
    branchId: number;
    weekStart: string;
    roles: Role[];
}) {
    let requirements: CoverageRequirementView[];
    let periods: ShiftPeriodView[];
    let gaps: CoverageGapRow[];

    try {
        [requirements, periods, gaps] = await Promise.all([
            fetchApi<CoverageRequirementView[]>(`/api/coverage-requirements?branchId=${branchId}`),
            fetchApi<ShiftPeriodView[]>(`/api/periods?branchId=${branchId}`),
            fetchApi<CoverageGapRow[]>(`/api/branches/${branchId}/coverage?weekStart=${weekStart}`),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return (
                <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertDescription>You don&apos;t have access to this branch&apos;s coverage.</AlertDescription>
                </Alert>
            );
        }
        throw error;
    }

    const sortedPeriods = sortPeriods(periods);

    if (sortedPeriods.length === 0 || roles.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>Nothing to set requirements for yet</EmptyTitle>
                    <EmptyDescription>
                        Coverage needs at least one role and one shift period for this branch.
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    const dates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">People required per period</h3>
                <RequirementsGrid
                    branchId={branchId}
                    periods={sortedPeriods.map(({ periodId, name, defaultStart, defaultEnd }) => ({
                        periodId,
                        name,
                        defaultStart,
                        defaultEnd,
                    }))}
                    rows={buildRequirementGrid(roles, sortedPeriods, requirements)}
                />
                <p className="text-xs text-muted-foreground">
                    Blank means no requirement is set. 0 means the role is explicitly not needed.
                </p>
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-medium">
                        Week of {formatDay(weekStart)}{" "}
                        <span className="font-normal text-muted-foreground">(scheduled / required)</span>
                    </h3>
                    <div className="flex gap-2">
                        <Link
                            href={weekHref(branchId, addDays(weekStart, -7))}
                            className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                            Previous week
                        </Link>
                        <Link
                            href={weekHref(branchId, addDays(weekStart, 7))}
                            className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                            Next week
                        </Link>
                    </div>
                </div>
                <WeeklyCoverage rows={buildWeeklyCoverage(gaps, roles, sortedPeriods, weekStart)} dates={dates} />
            </div>
        </div>
    );
}
