import { plural } from "@/i18n/locales";
import { common } from "./common";
import { words } from "./words";

export const schedule = {
    title: words.schedule,
    titleFor: (branch: string) => `Schedule for ${branch}`,
    loading: words.loading,
    noAccess: "You don't have access to the schedule.",
    noBranches: words.noBranches,
    noBranchesDescription: "The schedule is set per branch, and there are no branches to show.",
    doneEditing: "Done editing",
    editSchedule: "Edit schedule",
    print: "Print or save PDF",
    // section
    allCovered: "Every slot this week is covered.",
    slotsShort: (slots: number, people: number) =>
        `${plural("en", slots, { one: "# role slot", other: "# role slots" })} short (${plural("en", people, { one: "# person", other: "# people" })})`,
    legend: "Legend",
    legendNeeds: "Needs people (the cell says how many)",
    legendToday: common.today,
    legendRegisterSample: "Register 1",
    legendRegister: "Working that register (select it to change)",
    noBranchAccess: "You don't have access to this branch's schedule.",
    noPeriods: "No shift periods",
    noPeriodsDescription: (link: React.ReactNode) => (
        <>The schedule is filled per shift period, and none is active for this branch. Add or activate one on the {link}.</>
    ),
    periodsPage: "Periods page",
    nothingScheduled: (range: string) => `Nothing scheduled for ${range}`,
    nothingScheduledDescription: "Start from the week before, then adjust it in Edit schedule. Or fill the week from scratch there.",
    weekOf: (range: string) => `Week of ${range}`,
    noRequirements: (link: React.ReactNode) => (
        <>No coverage requirements yet. Set how many people each role needs on {link} so the schedule shows who is still needed.</>
    ),
    rolesLink: words.roles,
    customHoursShifts: "Custom-hours shifts",
    customHoursNote: "Not on an active period, so not counted above",
    day: words.day,
    hours: words.hours,
    person: words.person,
    // roster and grid
    rosterCaption: "Weekly schedule by shift period: who works each role, and the register each person is on",
    gridCaption: "Weekly schedule by shift period: people per role, with the register each person works",
    slot: "Slot",
    needs: (n: number) => `Needs ${n}`,
    needsMoreOf: (required: number) => ` more of ${required}`,
    noRegister: "No register",
    changeRegister: (name: string, register: string, where: string) => `${name} is on ${register}; change register (${where})`,
    putOnRegister: (name: string, where: string) => `Put ${name} on a register (${where})`,
    registerTag: "register",
    register: words.register,
    removeFrom: (name: string, where: string) => `Remove ${name} from ${where}`,
    add: "Add",
    addTo: (where: string) => `Add a person to ${where}`,
    onRegister: (name: string) => `On ${name}`,
    noneFree: (role: string) => `No ${role} free`,
    dayGroup: words.day,
    dayButton: (day: string, isToday: boolean, needs: boolean) => `${day}${isToday ? ", today" : ""}${needs ? ", needs people" : ""}`,
    // copy week
    copyNothing: (source: string) => `Nothing to copy: the week of ${source} has no shifts.`,
    copyNothingNew: (skipped: number) => `Nothing new copied: all ${skipped} shifts are already booked here or their people left the branch.`,
    copied: (created: number, skipped: number) => {
        const copied = `Copied ${plural("en", created, { one: "# shift", other: "# shifts" })}`;
        return skipped > 0 ? `${copied}; skipped ${skipped} already booked or no longer at the branch.` : `${copied}.`;
    },
    copyFailed: "Couldn't copy the week. Try again.",
    copyPrevious: "Copy previous week",
    copyTitle: (source: string) => `Copy the week of ${source}?`,
    copyDescription:
        "Everyone scheduled that week gets the same shift seven days later. Shifts already in this week stay as they are; anyone who would be double-booked, or has left the branch, is skipped.",
    copyShifts: "Copy shifts",
    // staff view
    notOnSchedule: "You're not on the schedule this week.",
    customHours: words.customHours,
    noOneScheduled: "No one scheduled.",
    otherHours: words.otherHours,
    you: "You",
    noBranchYet: words.noBranchYet,
    noBranchYetDescription: "You'll see the schedule once a manager adds you to a branch.",
    shiftsMissingConsequence: words.shiftsMissingConsequence,
    yourShifts: words.yourShifts,
    whosWorking: (branch: string) => `Who's working at ${branch}`,
};

export const coverage = {
    noBranchAccess: "You don't have access to this branch's coverage.",
    nothingToSet: "Nothing to set requirements for yet",
    nothingToSetDescription: "Coverage needs at least one role and one shift period for this branch.",
    perPeriod: "People required per period",
    blankHint: "Blank means not set yet. Enter 0 if the role isn't needed in that period.",
    countsAre: "Counts are scheduled / required;",
    short: "short",
    shortSr: "a short slot says by how many.",
    loading: words.loading,
    wholeNumber: (max: number) => `Enter a whole number from 0 to ${max}.`,
    gridCaption: "People required for each role in each shift period",
    role: words.role,
    cellLabel: (role: string, period: string) => `${role}, ${period}: people required`,
    noRequirements: "No requirements set",
    noRequirementsDescription: "Set how many people each role needs above to see coverage here.",
    weeklyCaption: "People scheduled compared with people required, per role, shift period and day",
    shortBy: (n: number) => `, short by ${n}`,
};
