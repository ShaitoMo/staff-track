import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserRow } from "@/lib/user-rows";

export function UserTable({ rows }: { rows: UserRow[] }) {
    return (
        <div className="hidden rounded-lg border border-border md:block">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Branches</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={row.userId}>
                            <TableCell>
                                <div className="font-medium">{row.name}</div>
                                <div className="font-mono text-xs text-muted-foreground">{row.phone}</div>
                            </TableCell>
                            <TableCell className="capitalize">{row.roleName}</TableCell>
                            <TableCell>
                                <Badge variant={row.isActive ? "outline" : "destructive"}>
                                    {row.isActive ? "Active" : "Inactive"}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-wrap gap-1">
                                    {row.branchChips.map((chip) => (
                                        <Badge key={chip} variant="secondary">{chip}</Badge>
                                    ))}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
