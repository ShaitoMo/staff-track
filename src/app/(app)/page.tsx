import { MyTaskList } from "@/components/tasks/my-task-list";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { fetchApi } from "@/lib/api-server";
import { MANAGER_ROLE, OWNER_ROLE } from "@/lib/rbac";
import { getSession } from "@/lib/session";
import type { TaskInstanceListView } from "@/types/task-instance";
import { SafeUser } from "@/types/user";

export default async function DashboardPage() {
    const session = await getSession();
    const canManage = session?.role === OWNER_ROLE || session?.role === MANAGER_ROLE;

    if (session && !canManage) {
        const instances = await fetchApi<TaskInstanceListView[]>(`/api/users/${session.userId}/tasks?status=pending`);

        return (
            <div className="flex flex-col gap-4">
                <h1 className="text-xl font-medium">My tasks</h1>
                {instances.length === 0 ? (
                    <Empty>
                        <EmptyHeader>
                            <EmptyTitle>No tasks right now</EmptyTitle>
                            <EmptyDescription>Tasks assigned to you will show up here.</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <MyTaskList instances={instances} />
                )}
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
