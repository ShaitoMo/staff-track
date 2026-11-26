import { isolate } from "@/i18n/locales";
import { words } from "./words";

/** Change password (your own, from the account menu) and Reset password (someone else's, on Edit user). */
export const password = {
    change: "Change password",
    changeDescription: "Your other devices will be signed out. This one stays signed in.",
    current: "Current password",
    new: "New password",
    confirm: "Confirm new password",
    changed: "Password changed.",
    done: "Done",
    resetLegend: words.password,
    resetDescription: (name: string) =>
        `Set a new password for ${isolate(name)} and give it to them in person. They'll be signed out on every device.`,
    reset: "Reset password",
    resetDone: (name: string) => `Password reset. Give ${isolate(name)} their new password.`,
    errors: {
        currentRequired: "Enter your current password.",
        length: "Password must be between 8 and 100 characters.",
        mismatch: "The passwords don't match.",
    },
};
