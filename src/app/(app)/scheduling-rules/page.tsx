import type { Metadata } from "next";
import { AccessMessage } from "@/components/layout/access-message";
import { SchedulingRulesEditor } from "@/components/schedule/scheduling-rules-editor";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ApiError } from "@/lib/api-client";
import { getDictionary } from "@/i18n/server";
import { fetchApi } from "@/lib/api-server";
import { sortPeriods } from "@/lib/coverage-rows";
import { getSelectedBranchId } from "@/lib/session";
import { Branch } from "@/types/branch";
import { Role } from "@/types/role";
import { ScheduleRules } from "@/types/schedule-builder";
import { ShiftPeriodView } from "@/types/shift-period";
import { SafeUser } from "@/types/user";

export async function generateMetadata(): Promise<Metadata> {
    return { title: (await getDictionary()).schedulingRules.title };
}

/** One branch's Auto-fill rules. Rules are per branch, so "All branches" asks for one instead of stacking. */
export default async function SchedulingRulesPage({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
    const [{ branch }, t] = await Promise.all([searchParams, getDictionary()]);

    let branches: Branch[];
    try {
        branches = await fetchApi<Branch[]>("/api/branches");
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title={t.schedulingRules.title} message={t.schedulingRules.noAccess} />;
        }
        throw error;
    }

    const branchId = await getSelectedBranchId(branch, branches);
    const branchName = branches.find((b) => b.branchId === branchId)?.name;

    if (branchId === undefined || branchName === undefined) {
        const none = branches.length === 0;
        return (
            <div className="flex flex-col gap-6">
                <h1 className="text-xl font-semibold">{t.schedulingRules.title}</h1>
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>{none ? t.schedulingRules.noBranches : t.schedulingRules.pickBranch}</EmptyTitle>
                        <EmptyDescription>
                            {none ? t.schedulingRules.noBranchesDescription : t.schedulingRules.pickBranchDescription}
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </div>
        );
    }

    let rules: ScheduleRules;
    let users: SafeUser[];
    let periods: ShiftPeriodView[];
    let roles: Role[];
    try {
        [rules, users, periods, roles] = await Promise.all([
            fetchApi<ScheduleRules>(`/api/schedule-rules?branchId=${branchId}`),
            fetchApi<SafeUser[]>(`/api/users?branch_id=${branchId}`),
            fetchApi<ShiftPeriodView[]>(`/api/periods?branchId=${branchId}`),
            fetchApi<Role[]>("/api/roles"),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title={t.schedulingRules.title} message={t.schedulingRules.noAccess} />;
        }
        throw error;
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-xl font-semibold">{t.schedulingRules.titleFor(branchName)}</h1>
                <p className="max-w-prose text-sm text-muted-foreground">{t.schedulingRules.intro}</p>
            </div>
            {/* keyed by branch so switching branches starts from that branch's saved rules */}
            <SchedulingRulesEditor
                key={branchId}
                branchId={branchId}
                initial={rules}
                people={users
                    .map(({ userId, name, isActive, roleId }) => ({
                        userId,
                        name,
                        isActive,
                        role: roles.find((role) => role.roleId === roleId)?.name ?? "",
                    }))
                    .toSorted((a, b) => a.name.localeCompare(b.name))}
                periods={sortPeriods(periods).map(({ periodId, name }) => ({ periodId, name }))}
            />
        </div>
    );
}
