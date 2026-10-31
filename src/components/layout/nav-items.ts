import {
    BookImage,
    CalendarDays,
    ClipboardList,
    Clock,
    House,
    LayoutDashboard,
    LayoutGrid,
    ListChecks,
    ScanBarcode,
    ShieldCheck,
    Store,
    Timer,
    Users,
    type LucideIcon,
} from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";

/** A key into the `nav` dictionary, resolved where the item renders. */
export type NavLabel = keyof Dictionary["nav"];

export interface NavItem {
    href: string;
    label: NavLabel;
    icon: LucideIcon;
}

/** Imported by the client nav components directly: an icon is a component, which can't cross from the server layout as a prop. */
export const MANAGER_NAV_GROUPS: { label: NavLabel; items: NavItem[] }[] = [
    { label: "groupToday", items: [{ href: "/", label: "dashboard", icon: LayoutDashboard }] },
    {
        label: "groupRun",
        items: [
            { href: "/schedule", label: "schedule", icon: CalendarDays },
            { href: "/attendance", label: "attendance", icon: Clock },
            { href: "/tasks", label: "tasks", icon: ListChecks },
            { href: "/guide", label: "shelfGuide", icon: BookImage },
        ],
    },
    {
        label: "groupSetup",
        items: [
            { href: "/users", label: "users", icon: Users },
            { href: "/branches", label: "branches", icon: Store },
            { href: "/registers", label: "registers", icon: ScanBarcode },
            { href: "/periods", label: "periods", icon: Timer },
            { href: "/roles", label: "roles", icon: ShieldCheck },
            { href: "/section-types", label: "sectionTypes", icon: LayoutGrid },
        ],
    },
];

/** Staff land on their today and tomorrow at "/"; the schedule and their attendance are read-only for them. */
export const STAFF_NAV: NavItem[] = [
    { href: "/", label: "home", icon: House },
    { href: "/my-tasks", label: "myTasks", icon: ClipboardList },
    { href: "/schedule", label: "schedule", icon: CalendarDays },
    { href: "/attendance", label: "attendance", icon: Clock },
    { href: "/guide", label: "guide", icon: BookImage },
];

/** "/" only matches itself; every other item also owns the pages under it (e.g. /tasks/new). */
export function isActive(href: string, pathname: string): boolean {
    return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
