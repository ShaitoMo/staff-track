import type { Metadata } from "next";
import Link from "next/link";
import { AccessMessage } from "@/components/layout/access-message";
import { buttonVariants } from "@/components/ui/button";
import { PageNav, pageHref } from "@/components/layout/page-nav";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { UserCards } from "@/components/users/user-cards";
import { UserTable } from "@/components/users/user-table";
import { ApiError } from "@/lib/api-client";
import { getDictionary } from "@/i18n/server";
import { fetchApi } from "@/lib/api-server";
import { OWNER_ROLE } from "@/lib/rbac";
import { getSelectedBranchId, getSession } from "@/lib/session";
import { buildUserRows } from "@/lib/user-rows";
import { Branch } from "@/types/branch";
import { Role } from "@/types/role";
import { UserPage, UserPageQuerySchema } from "@/types/user";
import { UserBranch } from "@/types/user-branch";

export async function generateMetadata(): Promise<Metadata> {
    return { title: (await getDictionary()).users.title };
}

export default async function UsersPage({
    searchParams,
}: {
    searchParams: Promise<{ branch?: string; page?: string }>;
}) {
    const [{ branch, page: pageParam }, session, t] = await Promise.all([searchParams, getSession(), getDictionary()]);
    // checked by the API's own rule; a ?page= it would refuse is read as the first page rather than an error
    const parsedPage = UserPageQuerySchema.shape.page.safeParse(pageParam);
    const requestedPage = parsedPage.success ? parsedPage.data : 1;
    // only the Owner adds a User; the API refuses anyone else, so a Manager isn't offered it
    const isOwner = session?.role === OWNER_ROLE;
    let branchId: number | undefined;
    let users: UserPage;
    let roles: Role[];
    let branches: Branch[];
    let userBranches: UserBranch[];

    try {
        [roles, branches, userBranches] = await Promise.all([
            fetchApi<Role[]>("/api/roles"),
            fetchApi<Branch[]>("/api/branches"),
            fetchApi<UserBranch[]>("/api/user-branches"),
        ]);
        // the top bar's branch is checked against the branches the API scoped to this viewer first
        branchId = await getSelectedBranchId(branch, branches);
        const usersQuery = new URLSearchParams({ page: String(requestedPage) });
        if (branchId !== undefined) {
            usersQuery.set("branch_id", String(branchId));
        }
        users = await fetchApi<UserPage>(`/api/users?${usersQuery}`);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title={t.users.title} message={t.users.noAccess} />;
        }
        throw error;
    }

    const rows = buildUserRows(users.items, roles, branches, userBranches, {
        allBranches: t.common.allBranches,
        noBranch: t.users.noBranch,
    });
    const pages = Math.ceil(users.total / users.limit);
    // page links keep a ?branch= link the viewer came in on; a branch picked in the top bar lives in the cookie
    const query: Record<string, string> = branch !== undefined ? { branch } : {};

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">{t.users.title}</h1>
                {isOwner ? (
                    <Link href="/users/new" className={buttonVariants({ size: "sm" })}>
                        {t.users.addUser}
                    </Link>
                ) : null}
            </div>
            {rows.length === 0 && users.page > 1 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>{t.users.noneFound}</EmptyTitle>
                        <EmptyDescription>{t.common.pagination.pastTheEnd}</EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <Link href={pageHref("/users", query, 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                            {t.common.pagination.backToFirst}
                        </Link>
                    </EmptyContent>
                </Empty>
            ) : rows.length === 0 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>{t.users.noneFound}</EmptyTitle>
                        <EmptyDescription>{branchId !== undefined ? t.users.noneAtBranch : t.users.noneYet}</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <>
                    <UserTable rows={rows} />
                    <UserCards rows={rows} />
                    <PageNav basePath="/users" query={query} page={users.page} pages={pages} />
                </>
            )}
        </div>
    );
}
