import { redirect } from "next/navigation";
import { AppNav } from "@/components/layout/app-nav";
import { LogoutButton } from "@/components/layout/logout-button";
import { MANAGER_ROLE, OWNER_ROLE } from "@/lib/rbac";
import { getSession } from "@/lib/session";

const MANAGER_NAV = [
    { href: "/users", label: "Users" },
    { href: "/branches", label: "Branches" },
    { href: "/registers", label: "Registers" },
    { href: "/schedule", label: "Schedule" },
    { href: "/attendance", label: "Attendance" },
    { href: "/tasks", label: "Tasks" },
    { href: "/roles", label: "Roles" },
];

/** Staff land on their tasks at "/"; the schedule and their attendance are read-only for them. */
const STAFF_NAV = [
    { href: "/", label: "My tasks" },
    { href: "/schedule", label: "Schedule" },
    { href: "/attendance", label: "Attendance" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const session = await getSession();

    if (!session) {
        redirect("/login");
    }

    const canManage = session.role === OWNER_ROLE || session.role === MANAGER_ROLE;

    return (
        <div className="flex min-h-screen flex-col">
            <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border px-6 py-3">
                <span className="font-heading text-base font-medium">StaffTrack</span>
                {/* on a phone the nav takes its own row under the brand and account */}
                <AppNav items={canManage ? MANAGER_NAV : STAFF_NAV} />
                <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="capitalize">{session.role}</span>
                    <LogoutButton />
                </div>
            </header>
            <main className="flex-1 px-6 py-6">{children}</main>
        </div>
    );
}
