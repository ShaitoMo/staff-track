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
    SlidersHorizontal,
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
    /** An Owner-only catalogue: a Manager can't change it, so it isn't in their sidebar. */
    ownerOnly?: true;
    /** What a Manager sees it called, when they can only use part of the page. */
    managerLabel?: NavLabel;
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
            { href: "/roles", label: "roles", managerLabel: "coverage", icon: ShieldCheck },
            { href: "/scheduling-rules", label: "schedulingRules", icon: SlidersHorizontal },
            { href: "/section-types", label: "sectionTypes", icon: LayoutGrid, ownerOnly: true },
        ],
    },
];

/**
 * The sections this viewer sees. A Manager loses the Owner-only items, and sees the roles page as
 * Coverage: only the Owner changes Roles, but a Manager sets their branch's coverage there.
 */
export function navGroupsFor(isOwner: boolean): typeof MANAGER_NAV_GROUPS {
    if (isOwner) return MANAGER_NAV_GROUPS;
    return MANAGER_NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items
            .filter((item) => !item.ownerOnly)
            .map((item) => (item.managerLabel ? { ...item, label: item.managerLabel } : item)),
    }));
}

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
