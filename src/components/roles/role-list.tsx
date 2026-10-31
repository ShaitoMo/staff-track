import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDictionary } from "@/i18n/server";
import type { RoleWithMembers } from "@/lib/role-members";

export async function RoleList({ roles }: { roles: RoleWithMembers[] }) {
    const t = await getDictionary();

    if (roles.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>{t.roles.noneYet}</EmptyTitle>
                    <EmptyDescription>{t.roles.noneYetDescription}</EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <div className="rounded-lg border border-border bg-card">
            <Table>
                <TableCaption className="sr-only">{t.roles.caption}</TableCaption>
                <TableHeader>
                    <TableRow>
                        {/* both shrink to their content so the count sits by its role and Who takes the rest */}
                        <TableHead scope="col" className="w-px pe-8">{t.roles.role}</TableHead>
                        <TableHead scope="col" className="w-px pe-8 text-end">{t.roles.people}</TableHead>
                        <TableHead scope="col">{t.roles.who}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {roles.map((role) => (
                        <TableRow key={role.roleId}>
                            <TableHead scope="row" className="h-auto py-2 pe-8 align-top capitalize">{role.name}</TableHead>
                            <TableCell className="pe-8 align-top text-end tabular-nums">{role.members.length}</TableCell>
                            <TableCell>
                                {role.members.length === 0 ? (
                                    <span className="text-muted-foreground">{t.roles.noOneYet}</span>
                                ) : (
                                    <ul className="flex flex-col gap-0.5">
                                        {role.members.map((member) => (
                                            <li key={member.userId}>
                                                {member.name}{" "}
                                                <bdi dir="ltr" className="font-mono text-xs text-muted-foreground">{member.phone}</bdi>
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
