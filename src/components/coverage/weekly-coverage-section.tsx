import { WeeklyCoverage } from "@/components/coverage/weekly-coverage";
import { fetchApi } from "@/lib/api-server";
import { buildWeeklyCoverage, weekDates } from "@/lib/coverage-rows";
import { CoverageGapRow } from "@/types/coverage-gap";
import { Role } from "@/types/role";
import { ShiftPeriodView } from "@/types/shift-period";

/** The only week-dependent part of the coverage screen, so it can reload on its own. */
export async function WeeklyCoverageSection({
    branchId,
    weekStart,
    roles,
    periods,
}: {
    branchId: number;
    weekStart: string;
    roles: Role[];
    periods: ShiftPeriodView[];
}) {
    const gaps = await fetchApi<CoverageGapRow[]>(`/api/branches/${branchId}/coverage?weekStart=${weekStart}`);
    const dates = weekDates(weekStart);

    return <WeeklyCoverage rows={buildWeeklyCoverage(gaps, roles, periods, weekStart)} dates={dates} />;
}
