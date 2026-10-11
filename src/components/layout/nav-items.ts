import {
    CalendarDays,
    ClipboardList,
    Clock,
    House,
    LayoutDashboard,
    ListChecks,
    ScanBarcode,
    ShieldCheck,
    Store,
    Users,
    type LucideIcon,
} from "lucide-react";

export interface NavItem {
    href: string;
    label: string;
    icon: LucideIcon;
}

/** Imported by the client nav components directly: an icon is a component, which can't cross from the server layout as a prop. */
export const MANAGER_NAV_GROUPS: { label: string; items: NavItem[] }[] = [
    { label: "Today", items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }] },
    {
        label: "Run",
        items: [
            { href: "/schedule", label: "Schedule", icon: CalendarDays },
            { href: "/attendance", label: "Attendance", icon: Clock },
            { href: "/tasks", label: "Tasks", icon: ListChecks },
        ],
    },
    {
        label: "Setup",
        items: [
            { href: "/users", label: "Users", icon: Users },
            { href: "/branches", label: "Branches", icon: Store },
            { href: "/registers", label: "Registers", icon: ScanBarcode },
            { href: "/roles", label: "Roles & coverage", icon: ShieldCheck },
        ],
    },
];

/** Staff land on their today and tomorrow at "/"; the schedule and their attendance are read-only for them. */
export const STAFF_NAV: NavItem[] = [
    { href: "/", label: "Home", icon: House },
    { href: "/my-tasks", label: "My tasks", icon: ClipboardList },
    { href: "/schedule", label: "Schedule", icon: CalendarDays },
    { href: "/attendance", label: "Attendance", icon: Clock },
];

/** "/" only matches itself; every other item also owns the pages under it (e.g. /tasks/new). */
export function isActive(href: string, pathname: string): boolean {
    return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
