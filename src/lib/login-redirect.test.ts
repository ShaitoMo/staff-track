import { nextPath } from "./login-redirect";

describe("nextPath — where a sign-in lands", () => {
    it("accepts a path on this site, query included", () => {
        expect(nextPath("/tasks?branch=2")).toBe("/tasks?branch=2");
    });

    it.each([
        ["missing", undefined],
        ["empty", ""],
        ["protocol-relative", "//evil.example"],
        ["backslash protocol-relative", "/\\evil.example"],
        ["absolute URL", "https://evil.example/tasks"],
        ["the login page", "/login"],
        ["the login page with a query", "/login?next=/tasks"],
    ])("falls back to / when next is %s", (_, next) => {
        expect(nextPath(next)).toBe("/");
    });
});
