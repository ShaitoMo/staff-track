import Link from "next/link";
import { Suspense } from "react";
import { AlertCircleIcon } from "lucide-react";
import { RequirementsGrid } from "@/components/coverage/requirements-grid";
import { WeeklyCoverageSection } from "@/components/coverage/weekly-coverage-section";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { addDays, buildRequirementGrid, formatDay, sortPeriods } from "@/lib/coverage-rows";
import { cn } from "@/lib/utils";
import { CoverageRequirementView } from "@/types/coverage-requirement";
import { Role } from "@/types/role";
import { ShiftPeriodView } from "@/types/shift-period";

/** Touch screens get a full 44px tap target; mouse layouts keep the compact size. */
const weekLinkTouch = "[@media(pointer:coarse)]:h-11";

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
                            scroll={false}
                            className={cn(buttonVariants({ variant: "outline", size: "sm" }), weekLinkTouch)}
                        >
                            Previous week
                        </Link>
                        <Link
                            href={weekHref(branchId, addDays(weekStart, 7))}
                            scroll={false}
                            className={cn(buttonVariants({ variant: "outline", size: "sm" }), weekLinkTouch)}
                        >
                            Next week
                        </Link>
                    </div>
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
