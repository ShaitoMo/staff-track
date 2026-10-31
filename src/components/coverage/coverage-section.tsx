import { Suspense } from "react";
import { AlertCircleIcon } from "lucide-react";
import { RequirementsGrid } from "@/components/coverage/requirements-grid";
import { WeeklyCoverageSection } from "@/components/coverage/weekly-coverage-section";
import { WeekNav } from "@/components/layout/week-nav";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { getI18n } from "@/i18n/server";
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
    const { t, locale } = await getI18n();
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
                    <AlertDescription>{t.coverage.noBranchAccess}</AlertDescription>
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
                    <EmptyTitle>{t.coverage.nothingToSet}</EmptyTitle>
                    <EmptyDescription>{t.coverage.nothingToSetDescription}</EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">{t.coverage.perPeriod}</h3>
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
                <p className="text-xs text-muted-foreground">{t.coverage.blankHint}</p>
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
                        <h3 className="text-sm font-medium tabular-nums">{formatWeekRange(weekStart, locale)}</h3>
                    )}
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {t.coverage.countsAre}
                        <span aria-hidden="true" className="flex items-center gap-1.5">
                            <span className={NEEDS_DOT} />
                            {t.coverage.short}
                        </span>
                        <span className="sr-only">{t.coverage.shortSr}</span>
                    </span>
                </div>
                {/* Keyed by week only, so changing the week reloads just this table and leaves the grid in place. */}
                <Suspense
                    key={weekStart}
                    fallback={
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Spinner /> {t.coverage.loading}
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
