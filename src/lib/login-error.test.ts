import { login } from "@/i18n/dictionaries/en/login";
import { ApiError } from "@/lib/api-client";
import { loginErrorMessage } from "@/lib/login-error";

describe("loginErrorMessage", () => {
    it("says the server can't be reached when the request never got an answer", () => {
        expect(loginErrorMessage(new TypeError("Failed to fetch"), login)).toBe(
            "Can't reach the server. Check your connection and try again.",
        );
    });

    it("says the phone or password is wrong only on a 401", () => {
        expect(loginErrorMessage(new ApiError("Invalid credentials", 401), login)).toBe("Invalid phone or password.");
    });

    it("shows the server's own message for any other refusal", () => {
        const lockedOut = new ApiError("Too many failed attempts. Try again later.", 429);
        expect(loginErrorMessage(lockedOut, login)).toBe("Too many failed attempts. Try again later.");
    });
});
