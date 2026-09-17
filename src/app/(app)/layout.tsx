import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { getSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const session = await getSession();

    if (!session) {
        redirect("/login");
    }

    return (
        <div className="flex min-h-screen flex-col">
            <header className="flex items-center justify-between border-b border-border px-6 py-3">
                <span className="font-heading text-base font-medium">StaffTrack</span>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="capitalize">{session.role}</span>
                    <LogoutButton />
                </div>
            </header>
            <main className="flex-1 px-6 py-6">{children}</main>
        </div>
    );
}
