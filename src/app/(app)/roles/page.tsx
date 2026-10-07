import { Suspense } from "react";
import { AccessMessage } from "@/components/layout/access-message";
import { BranchStack } from "@/components/layout/branch-stack";
import { WeekNav } from "@/components/layout/week-nav";
import { CoverageSection } from "@/components/coverage/coverage-section";
import { RoleForm } from "@/components/roles/role-form";
import { RoleList } from "@/components/roles/role-list";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { mondayOf } from "@/lib/coverage-rows";
import { parseDateParam, todayDateString } from "@/lib/instance-rows";
import { OWNER_ROLE } from "@/lib/rbac";
import { buildRoleMembers } from "@/lib/role-members";
import { getSelectedBranchId, getSession } from "@/lib/session";
import { Branch } from "@/types/branch";
import { Role } from "@/types/role";
import { SafeUser } from "@/types/user";

const loading = (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
    </div>
);

export default async function RolesPage({
    searchParams,
}: {
    searchParams: Promise<{ branch?: string; week?: string }>;
}) {
    const { branch, week } = await searchParams;
    const session = await getSession();

    let branches: Branch[];
    let roles: Role[];
    let users: SafeUser[];

    try {
        [branches, roles, users] = await Promise.all([
            fetchApi<Branch[]>("/api/branches"),
            fetchApi<Role[]>("/api/roles"),
            fetchApi<SafeUser[]>("/api/users"),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title="Roles & coverage" message="You don't have access to view roles and coverage." />;
        }
        throw error;
    }

    const isOwner = session?.role === OWNER_ROLE;
    const visibleRoles = isOwner ? roles : roles.filter((role) => role.name !== OWNER_ROLE);

    const branchId = await getSelectedBranchId(branch, branches);
    const branchName = branches.find((b) => b.branchId === branchId)?.name;
    const weekStart = mondayOf(parseDateParam(week));

    return (
        <div className="flex flex-col gap-8">
            <h1 className="text-xl font-semibold">Roles &amp; coverage</h1>

            <section aria-labelledby="roles-heading" className="flex flex-col gap-4">
                <h2 id="roles-heading" className="text-base font-medium">Roles</h2>
                {isOwner ? <RoleForm /> : null}
                {isOwner ? null : (
                    <p className="text-xs text-muted-foreground">
                        Showing only the people in your branches.
                    </p>
                )}
                <RoleList roles={buildRoleMembers(visibleRoles, users)} />
            </section>

            <section aria-labelledby="coverage-heading" className="flex flex-col gap-4">
                <h2 id="coverage-heading" className="text-base font-medium">
                    {branchName ? `Coverage for ${branchName}` : "Coverage"}
                </h2>
                {branches.length === 0 ? (
                    <Empty>
                        <EmptyHeader>
                            <EmptyTitle>No branches</EmptyTitle>
                            <EmptyDescription>Coverage is set per branch, and there are no branches to show.</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : branchId === undefined ? (
                    // "All branches" in the top bar: one week nav, then every branch's coverage
                    <>
                        <WeekNav basePath="/roles" weekStart={weekStart} thisWeek={mondayOf(todayDateString())} query={{}} heading="h3" />
                        <BranchStack branches={branches} basePath="/roles" query={{ week: weekStart }} heading="h3">
                            {(b) => (
                                <Suspense key={b.branchId} fallback={loading}>
                                    <CoverageSection branchId={b.branchId} weekStart={weekStart} roles={visibleRoles} showWeekNav={false} />
                                </Suspense>
                            )}
                        </BranchStack>
                    </>
                ) : (
                    // Keyed by branch only: a new week reloads just the weekly table inside the section.
                    <Suspense key={branchId} fallback={loading}>
                        <CoverageSection branchId={branchId} weekStart={weekStart} roles={visibleRoles} />
                    </Suspense>
                )}
            </section>
        </div>
    );
}
