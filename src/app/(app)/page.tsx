import { Suspense } from "react";
import { StaffDashboard } from "@/components/tasks/staff-dashboard";
import { Spinner } from "@/components/ui/spinner";
import { fetchApi } from "@/lib/api-server";
import { MANAGER_ROLE, OWNER_ROLE } from "@/lib/rbac";
import { getSession } from "@/lib/session";
import { SafeUser } from "@/types/user";

export default async function DashboardPage() {
    const session = await getSession();
    const canManage = session?.role === OWNER_ROLE || session?.role === MANAGER_ROLE;

    if (session && !canManage) {
        return (
            <div className="flex flex-col gap-4">
                <h1 className="text-xl font-medium">My tasks</h1>
                <Suspense
                    fallback={
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Spinner /> Loading…
                        </div>
                    }
                >
                    <StaffDashboard userId={session.userId} />
                </Suspense>
            </div>
        );
    }

    const user = session ? await fetchApi<SafeUser>(`/api/users/${session.userId}`) : null;

    return (
        <div>
            <h1 className="text-xl font-medium">Welcome back{user ? `, ${user.name}` : ""}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Signed in as {session?.role}.</p>
        </div>
    );
}
