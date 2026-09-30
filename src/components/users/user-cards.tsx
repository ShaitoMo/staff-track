import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { UserRow } from "@/lib/user-rows";

export function UserCards({ rows }: { rows: UserRow[] }) {
    return (
        <div className="flex flex-col gap-3 md:hidden">
            {rows.map((row) => (
                <Card key={row.userId}>
                    <CardContent className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <div className="font-medium">{row.name}</div>
                                <div className="font-mono text-xs text-muted-foreground">{row.phone}</div>
                            </div>
                            <Badge variant={row.isActive ? "outline" : "destructive"}>
                                {row.isActive ? "Active" : "Inactive"}
                            </Badge>
                        </div>
                        <div className="text-sm capitalize">{row.roleName}</div>
                        <div className="flex flex-wrap gap-1">
                            {row.branchChips.map((chip) => (
                                <Badge key={chip} variant="secondary">{chip}</Badge>
                            ))}
                        </div>
                        <Link
                            href={`/users/${row.userId}/edit`}
                            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-1 w-fit")}
                        >
                            Edit
                        </Link>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
