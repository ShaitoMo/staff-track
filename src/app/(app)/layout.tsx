import Link from "next/link";
import { redirect } from "next/navigation";
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

/** Staff land on their tasks at "/"; the schedule is read-only for them. */
const STAFF_NAV = [
    { href: "/", label: "My tasks" },
    { href: "/schedule", label: "Schedule" },
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
                <nav className="order-last flex w-full flex-wrap items-center gap-x-4 gap-y-1 md:order-none md:w-auto">
                    {(canManage ? MANAGER_NAV : STAFF_NAV).map((item) => (
                        <Link key={item.href} href={item.href} className="text-sm font-medium text-foreground hover:text-primary">
                            {item.label}
                        </Link>
                    ))}
                </nav>
                <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="capitalize">{session.role}</span>
                    <LogoutButton />
                </div>
            </header>
            <main className="flex-1 px-6 py-6">{children}</main>
        </div>
    );
}
