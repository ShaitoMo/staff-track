import { fetchApi } from "@/lib/api-server";
import { getSession } from "@/lib/session";
import { SafeUser } from "@/types/user";

export default async function DashboardPage() {
    const session = await getSession();
    const user = session ? await fetchApi<SafeUser>(`/api/users/${session.userId}`) : null;

    return (
        <div>
            <h1 className="text-xl font-medium">Welcome back{user ? `, ${user.name}` : ""}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Signed in as {session?.role}.</p>
        </div>
    );
}
