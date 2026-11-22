import { words } from "./words";

export const login = {
    title: "Sign in",
    description: "Sign in with your phone number and password.",
    phone: words.phone,
    password: words.password,
    phoneRequired: words.phoneRequired,
    passwordRequired: "Password is required.",
    invalidCredentials: "Invalid phone or password.",
    signIn: "Sign in",
};

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
        `Set a new password for ${name} and give it to them in person. They'll be signed out on every device.`,
    reset: "Reset password",
    resetDone: (name: string) => `Password reset. Give ${name} their new password.`,
    failed: "The password couldn't be changed. Try again.",
    errors: {
        currentRequired: "Enter your current password.",
        length: "Password must be between 8 and 100 characters.",
        mismatch: "The passwords don't match.",
    },
};
