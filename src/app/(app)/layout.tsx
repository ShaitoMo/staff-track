import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountMenu } from "@/components/layout/account-menu";
import { BranchSwitcher } from "@/components/layout/branch-switcher";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { StaffNav, StaffTabBar } from "@/components/layout/staff-nav";
import { fetchApi } from "@/lib/api-server";
import { MANAGER_ROLE, OWNER_ROLE } from "@/lib/rbac";
import { getBranchPreference, getSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { Branch } from "@/types/branch";
import { SafeUser } from "@/types/user";

/**
 * The shell. Owners and managers: a top bar with the branch every page follows, and a left bar of
 * sections (a slide-out menu below `lg`). Staff: no left bar — top-bar links from `md`, a bottom tab
 * bar on a phone. The name and branches are a nicety: if either read fails, the bar falls back to
 * the role and an empty switcher rather than taking the page down.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const session = await getSession();

    if (!session) {
        redirect("/login");
    }

    const canManage = session.role === OWNER_ROLE || session.role === MANAGER_ROLE;
    const [userResult, branchesResult, preference] = await Promise.all([
        fetchApi<SafeUser>(`/api/users/${session.userId}`).then(
            (user) => user,
            () => null,
        ),
        canManage
            ? fetchApi<Branch[]>("/api/branches").then(
                  (branches) => branches,
                  () => [],
              )
            : Promise.resolve([]),
        getBranchPreference(),
    ]);
    const branches = branchesResult.map(({ branchId, name }) => ({ branchId, name }));

    return (
        <div className="flex min-h-screen flex-col">
            <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center border-b border-border bg-background">
                {/* on a wide screen the brand sits over the left bar, so the switcher lines up with the page */}
                <div
                    className={cn(
                        "flex h-full shrink-0 items-center gap-1 pr-3",
                        canManage ? "pl-2 lg:w-56 lg:border-r lg:border-border lg:pl-5" : "pl-4 lg:pl-6",
                    )}
                >
                    {canManage ? (
                        <div className="lg:hidden">
                            <MobileNav />
                        </div>
                    ) : null}
                    <Link href="/" className="text-base font-semibold whitespace-nowrap">
                        StaffTrack
                    </Link>
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-3 pr-2 lg:px-6">
                    {canManage ? (
                        <Suspense>
                            <BranchSwitcher branches={branches} preference={preference} />
                        </Suspense>
                    ) : (
                        <StaffNav />
                    )}
                    <div className="ml-auto shrink-0">
                        <AccountMenu name={userResult?.name ?? null} role={session.role} />
                    </div>
                </div>
            </header>
            <div className="flex flex-1">
                {canManage ? (
                    <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 overflow-y-auto border-r border-border px-3 py-5 lg:block">
                        <SidebarNav />
                    </aside>
                ) : null}
                {/* staff pages leave room for the tab bar on a phone */}
                <main className={cn("min-w-0 flex-1 px-4 py-6 lg:px-6", !canManage && "pb-24 md:pb-6")}>{children}</main>
            </div>
            {canManage ? null : <StaffTabBar />}
        </div>
    );
}
