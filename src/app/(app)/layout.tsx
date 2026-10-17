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
            {/* the first Tab stop: past the switcher, the left bar and the account menu, straight to the page */}
            <a
                href="#main"
                className="sr-only rounded-md bg-card px-3 py-2 text-sm font-medium text-primary ring-1 ring-foreground/10 focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
            >
                Skip to content
            </a>
            <header
                className={cn(
                    // Card, a step up from the Paper page, so the bar reads as its own band (no shadow: flat by default)
                    "sticky top-0 z-30 flex h-14 shrink-0 items-center border-b border-border bg-card",
                    // the dark column runs unbroken past the top bar, so its light rule stops where the column starts
                    canManage && "lg:border-b-0",
                )}
            >
                {/* on a wide screen the brand tops the dark left bar, so the switcher lines up with the page */}
                <div
                    className={cn(
                        "flex h-full shrink-0 items-center gap-1 pr-3",
                        canManage
                            ? "pl-2 lg:w-56 lg:bg-sidebar lg:pl-5 lg:text-sidebar-foreground"
                            : "pl-4 lg:pl-6",
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
                <div className={cn("flex h-full min-w-0 flex-1 items-center gap-3 pr-2 lg:px-6", canManage && "lg:border-b lg:border-border")}>
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
                    <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 overflow-y-auto bg-sidebar px-3 py-5 text-sidebar-foreground lg:block">
                        <SidebarNav />
                    </aside>
                ) : null}
                {/* staff pages leave room for the tab bar on a phone */}
                <main id="main" tabIndex={-1} className={cn("min-w-0 flex-1 px-4 py-6 lg:px-6", !canManage && "pb-24 md:pb-6")}>{children}</main>
            </div>
            {canManage ? null : <StaffTabBar />}
        </div>
    );
}
