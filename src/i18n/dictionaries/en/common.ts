export const common = {
    appName: "StaffTrack",
    appDescription: "Scheduling, tasks, attendance, and coverage for StaffTrack's branches.",
    somethingWentWrong: "Something went wrong.",
    loading: "Loading",
    close: "Close",
    cancel: "Cancel",
    save: "Save",
    edit: "Edit",
    delete: "Delete",
    today: "Today",
    tomorrow: "Tomorrow",
    allBranches: "All branches",
    noBranch: "No branch",
    languageName: "English",
    /** Between the items of a run-on list: "Morning, Evening". */
    listSeparator: ", ",
    /** A photo whose file is gone or that the viewer may no longer see. `title` is also the fallback tile's label; `description` is for the new-tab page only. */
    photoUnavailable: {
        title: "Photo unavailable",
        description: "This photo was removed, or you no longer have access to it. Close this tab to go back.",
    },
    /** The Previous / Next pager under a long list. */
    pagination: {
        label: "Pages",
        previous: "Previous",
        next: "Next",
        pageOf: (page: number, pages: number) => `Page ${page} of ${pages}`,
        pastTheEnd: "This page is past the end of the list.",
        backToFirst: "Back to page 1",
    },
    /** Asked before a form with unsaved changes is closed or left. */
    discardChanges: {
        title: "Discard your changes?",
        description: "What you entered here hasn't been saved and will be lost.",
        keepEditing: "Keep editing",
        discard: "Discard",
    },
};
