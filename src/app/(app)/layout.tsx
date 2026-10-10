import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/layout/logout-button";
import { MANAGER_ROLE, OWNER_ROLE } from "@/lib/rbac";
import { getSession } from "@/lib/session";

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
                {canManage ? (
                    // on a phone the nav takes its own row under the brand and account
                    <nav className="order-last flex w-full items-center gap-4 md:order-none md:w-auto">
                        <Link href="/users" className="text-sm font-medium text-foreground hover:text-primary">
                            Users
                        </Link>
                        <Link href="/branches" className="text-sm font-medium text-foreground hover:text-primary">
                            Branches
                        </Link>
                        <Link href="/registers" className="text-sm font-medium text-foreground hover:text-primary">
                            Registers
                        </Link>
                        <Link href="/tasks" className="text-sm font-medium text-foreground hover:text-primary">
                            Tasks
                        </Link>
                    </nav>
                ) : null}
                <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="capitalize">{session.role}</span>
                    <LogoutButton />
                </div>
            </header>
            <main className="flex-1 px-6 py-6">{children}</main>
        </div>
    );
}
