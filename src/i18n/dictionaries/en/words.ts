/**
 * Words used by several screens, written once: the other dictionary files point at these instead of
 * repeating them, so a term reads the same everywhere and changes in one place. A screen whose wording
 * has to differ (Arabic gender agreement, say) keeps its own string instead.
 */
export const words = {
    loading: "Loading…",
    noBranches: "No branches",
    show: "Show",
    status: "Status",
    day: "Day",
    date: "Date",
    hours: "Hours",
    customHours: "Custom hours",
    actions: "Actions",
    title: "Title",
    active: "Active",
    inactive: "Inactive",
    activate: "Activate",
    deactivate: "Deactivate",
    saveChanges: "Save changes",

    branch: "Branch",
    branches: "Branches",
    person: "Person",
    users: "Users",
    role: "Role",
    roles: "Roles",
    rolesAndCoverage: "Roles & coverage",
    register: "Register",
    registers: "Registers",
    periods: "Periods",
    tasks: "Tasks",
    schedule: "Schedule",
    attendance: "Attendance",
    shelfGuide: "Shelf guide",
    sectionTypes: "Section types",

    selectBranch: "Select a branch",
    selectPerson: "Select a person",
    selectRole: "Select a role",

    phone: "Phone",
    password: "Password",
    phoneRequired: "Phone is required.",

    yourShifts: "Your shifts",
    otherHours: "Other hours",
    notImportedYet: "Not imported yet",
    noBranchYet: "No branch yet",
    /** Finishes a sentence: "one of your branches couldn't be loaded, so …". */
    shiftsMissingConsequence: "shifts there are missing below",
};
