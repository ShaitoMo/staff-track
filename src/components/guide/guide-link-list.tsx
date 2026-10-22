import Link from "next/link";
import { ChevronRightIcon, FolderIcon, LayoutGridIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface GuideLink {
    href: string;
    name: string;
    active: boolean;
}

/** Sections of a branch, or the folders at one level: one row each, opening the page behind it. */
export function GuideLinkList({ items, kind }: { items: GuideLink[]; kind: "section" | "folder" }) {
    const Icon = kind === "section" ? LayoutGridIcon : FolderIcon;

    return (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {items.map((item) => (
                <li key={item.href}>
                    <Link
                        href={item.href}
                        className="flex min-h-11 items-center gap-3 px-3 py-2 text-sm hover:bg-muted/60"
                    >
                        <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
                        {item.active ? null : (
                            <Badge variant="outline" className="border-dashed text-muted-foreground">Inactive</Badge>
                        )}
                        <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                </li>
            ))}
        </ul>
    );
}
