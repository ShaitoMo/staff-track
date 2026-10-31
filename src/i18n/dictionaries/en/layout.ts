import { plural } from "@/i18n/locales";
import { common } from "./common";
import { words } from "./words";

export const layout = {
    skipToContent: "Skip to content",
    sections: "Sections",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    account: (who: string) => `Account: ${who}`,
    logOut: "Log out",
    branch: words.branch,
    branchTrigger: (name: string) => `Branch: ${name}. Change branch`,
    onlyThisBranch: "Only this branch",
    previousDay: "Previous day",
    nextDay: "Next day",
    backToToday: "Back to today",
    previousWeek: "Previous week",
    nextWeek: "Next week",
    thisWeek: "This week",
    backToThisWeek: "Back to this week",
    branchesFailed: (failed: number, consequence: string) =>
        plural("en", failed, {
            one: `One of your branches couldn't be loaded, so ${consequence}. Reload the page to try again.`,
            other: `# of your branches couldn't be loaded, so ${consequence}. Reload the page to try again.`,
        }),
};

export const nav = {
    groupToday: common.today,
    groupRun: "Run",
    groupSetup: "Setup",
    dashboard: "Dashboard",
    schedule: words.schedule,
    attendance: words.attendance,
    tasks: words.tasks,
    shelfGuide: words.shelfGuide,
    users: words.users,
    branches: words.branches,
    registers: words.registers,
    periods: words.periods,
    roles: words.rolesAndCoverage,
    sectionTypes: words.sectionTypes,
    home: "Home",
    myTasks: "My tasks",
    guide: "Guide",
};
