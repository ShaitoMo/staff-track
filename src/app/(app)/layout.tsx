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
            <header className="flex items-center justify-between border-b border-border px-6 py-3">
                <div className="flex items-center gap-6">
                    <span className="font-heading text-base font-medium">StaffTrack</span>
                    {canManage && (
                        <nav className="flex items-center gap-4">
                            <Link href="/users" className="text-sm font-medium text-foreground hover:text-primary">
                                Users
                            </Link>
                            <Link href="/branches" className="text-sm font-medium text-foreground hover:text-primary">
                                Branches
                            </Link>
                        </nav>
                    )}
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="capitalize">{session.role}</span>
                    <LogoutButton />
                </div>
            </header>
            <main className="flex-1 px-6 py-6">{children}</main>
        </div>
    );
}
