import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RoleWithMembers } from "@/lib/role-members";

export function RoleList({ roles }: { roles: RoleWithMembers[] }) {
    if (roles.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>No roles yet</EmptyTitle>
                    <EmptyDescription>Roles you add will show up here with the people who hold them.</EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <div className="rounded-lg border border-border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">People</TableHead>
                        <TableHead>Who</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {roles.map((role) => (
                        <TableRow key={role.roleId}>
                            <TableCell className="align-top font-medium">{role.name}</TableCell>
                            <TableCell className="align-top text-right tabular-nums">{role.members.length}</TableCell>
                            <TableCell>
                                {role.members.length === 0 ? (
                                    <span className="text-muted-foreground">No one yet</span>
                                ) : (
                                    <ul className="flex flex-col gap-0.5">
                                        {role.members.map((member) => (
                                            <li key={member.userId}>
                                                {member.name}{" "}
                                                <span className="font-mono text-xs text-muted-foreground">{member.phone}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
