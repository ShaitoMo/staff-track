import { Suspense } from "react";
import { AlertCircleIcon } from "lucide-react";
import { RequirementsGrid } from "@/components/coverage/requirements-grid";
import { WeeklyCoverageSection } from "@/components/coverage/weekly-coverage-section";
import { WeekNav } from "@/components/layout/week-nav";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { buildRequirementGrid, formatWeekRange, mondayOf, sortPeriods } from "@/lib/coverage-rows";
import { todayDateString } from "@/lib/instance-rows";
import { NEEDS_DOT } from "@/lib/schedule-grid";
import { CoverageRequirementView } from "@/types/coverage-requirement";
import { Role } from "@/types/role";
import { ShiftPeriodView } from "@/types/shift-period";

export async function CoverageSection({
    branchId,
    weekStart,
    roles,
    showWeekNav = true,
}: {
    branchId: number;
    weekStart: string;
    roles: Role[];
    /** False when the page shows one week nav over several stacked branches. */
    showWeekNav?: boolean;
}) {
    let requirements: CoverageRequirementView[];
    let periods: ShiftPeriodView[];

    try {
        [requirements, periods] = await Promise.all([
            fetchApi<CoverageRequirementView[]>(`/api/coverage-requirements?branchId=${branchId}`),
            fetchApi<ShiftPeriodView[]>(`/api/periods?branchId=${branchId}`),
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
                    Blank means not set yet. Enter 0 if the role isn&apos;t needed in that period.
                </p>
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    {showWeekNav ? (
                        <WeekNav
                            basePath="/roles"
                            weekStart={weekStart}
                            thisWeek={mondayOf(todayDateString())}
                            query={{ branch: String(branchId) }}
                            heading="h3"
                        />
                    ) : (
                        <h3 className="text-sm font-medium tabular-nums">{formatWeekRange(weekStart)}</h3>
                    )}
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        Counts are scheduled / required;
                        <span aria-hidden="true" className="flex items-center gap-1.5">
                            <span className={NEEDS_DOT} />
                            short
                        </span>
                        <span className="sr-only">a short slot says by how many.</span>
                    </span>
                </div>
                {/* Keyed by week only, so changing the week reloads just this table and leaves the grid in place. */}
                <Suspense
                    key={weekStart}
                    fallback={
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Spinner /> Loading…
                        </div>
                    }
                >
                    <WeeklyCoverageSection
                        branchId={branchId}
                        weekStart={weekStart}
                        roles={roles}
                        periods={sortedPeriods}
                    />
                </Suspense>
            </div>
        </div>
    );
}
