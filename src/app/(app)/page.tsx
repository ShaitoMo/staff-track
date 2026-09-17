import { getSession } from "@/lib/session";

export default async function DashboardPage() {
    const session = await getSession();

    return (
        <div>
            <h1 className="text-xl font-medium">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">
                Signed in as user #{session?.userId} ({session?.role}).
            </p>
        </div>
    );
}
