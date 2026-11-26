import { errors } from "@/i18n/dictionaries/en/errors";
import { ApiError, PhotoUploadError, throwApiError } from "@/lib/api-client";
import { alreadyCompletedState, translateError } from "@/lib/error-messages";

const userFields = { name: "name", phone: "phone" } as const;

describe("translateError", () => {
    it("translates a known top-level code", () => {
        const error = new ApiError("Your role does not permit this action", 403, { code: "INSUFFICIENT_ROLE" });

        expect(translateError(error, errors)).toEqual({
            formMessage: "Your role isn't allowed to do this.",
            fieldMessages: {},
        });
    });

    it("puts a generic field code under its field, with no banner when every problem is placed", () => {
        const error = new ApiError("name: Too big", 400, {
            code: "VALIDATION_FAILED",
            fields: [{ path: "name", code: "TOO_LONG" }],
        });

        expect(translateError(error, errors, userFields)).toEqual({
            formMessage: null,
            fieldMessages: { name: "Too long." },
        });
    });

    it("places a domain error on the field it names, worded as the domain error", () => {
        const error = new ApiError("User with this phone number already exists", 409, {
            code: "DUPLICATE_PHONE",
            fields: [{ path: "phone", code: "DUPLICATE_PHONE" }],
        });

        expect(translateError(error, errors, userFields).fieldMessages).toEqual({
            phone: "This phone number is already in use.",
        });
    });

    it("translates a custom rule's own field code, mapped onto the form's key", () => {
        const error = new ApiError("Provide exactly one of assigned_to or assigned_role_id", 400, {
            code: "VALIDATION_FAILED",
            fields: [{ path: "assigned_to", code: "ASSIGNEE_XOR_ROLE" }],
        });

        expect(translateError(error, errors, { assigned_to: "assignee" }).fieldMessages).toEqual({
            assignee: "Pick a person or a role, not both.",
        });
    });

    it("keeps the banner when a field error has nowhere to go on this form", () => {
        const error = new ApiError("bad", 400, {
            code: "VALIDATION_FAILED",
            fields: [{ path: "name", code: "REQUIRED" }, { path: "roleId", code: "REQUIRED" }],
        });

        expect(translateError(error, errors, userFields)).toEqual({
            formMessage: "Some details aren't valid. Check them and try again.",
            fieldMessages: { name: "Required." },
        });
    });

    it("names a whole-body rule with its own sentence instead of the generic validation text", () => {
        const error = new ApiError("At least one field must be provided", 400, {
            code: "VALIDATION_FAILED",
            fields: [{ path: "", code: "NO_FIELDS" }],
        });

        expect(translateError(error, errors, userFields).formMessage).toBe("Nothing was changed, so there's nothing to save.");
    });

    it("falls back to the server's text for a code it doesn't know yet", () => {
        const error = new ApiError("The solver is resting", 503, { code: "SOMETHING_NEW" });

        expect(translateError(error, errors).formMessage).toBe("The solver is resting");
    });

    it("shows the server's text for a body in the old shape, with no code", () => {
        expect(translateError(new ApiError("Request to /api/x failed (502)", 502), errors).formMessage).toBe(
            "Request to /api/x failed (502)",
        );
    });

    it("says the server can't be reached when the request never got an answer", () => {
        expect(translateError(new TypeError("Failed to fetch"), errors).formMessage).toBe(
            "Can't reach the server. Check your connection and try again.",
        );
    });

    it("says something went wrong for anything else thrown", () => {
        expect(translateError(new Error("boom"), errors).formMessage).toBe("Something went wrong.");
    });

    it("translates a failed direct photo upload", () => {
        expect(translateError(new PhotoUploadError(), errors).formMessage).toBe(
            "The photo didn't upload. Check your connection and try again.",
        );
    });

    it("words a wrong phone or password at sign-in", () => {
        const error = new ApiError("Invalid phone or password", 401, { code: "INVALID_CREDENTIALS" });

        expect(translateError(error, errors).formMessage).toBe("Invalid phone or password.");
    });
});

describe("alreadyCompletedState", () => {
    it("passes through who completed the instance and when", () => {
        const current = { status: "completed", completed_by_name: "Omar", completed_at: "2026-11-26T09:15:00.000Z" };
        const error = new ApiError("already", 409, { code: "INSTANCE_ALREADY_COMPLETED", current });

        expect(alreadyCompletedState(error)).toEqual(current);
    });

    it("is null for any other error", () => {
        expect(alreadyCompletedState(new ApiError("off", 409, { code: "TASK_INACTIVE" }))).toBeNull();
    });
});

describe("throwApiError", () => {
    const respond = (body: unknown, status: number) =>
        new Response(typeof body === "string" ? body : JSON.stringify(body), { status });

    it("reads the code, fields and current from an error body", async () => {
        const body = { error: "bad", code: "VALIDATION_FAILED", fields: [{ path: "name", code: "REQUIRED" }] };

        await expect(throwApiError(respond(body, 400), "fallback")).rejects.toMatchObject({
            message: "bad",
            status: 400,
            code: "VALIDATION_FAILED",
            fields: [{ path: "name", code: "REQUIRED" }],
        });
    });

    it("keeps the message of a body without a code", async () => {
        await expect(throwApiError(respond({ error: "old shape" }, 400), "fallback")).rejects.toMatchObject({
            message: "old shape",
            code: undefined,
        });
    });

    it("uses the fallback for a body that isn't JSON", async () => {
        await expect(throwApiError(respond("<html>Bad gateway</html>", 502), "fallback")).rejects.toMatchObject({
            message: "fallback",
            status: 502,
        });
    });
});
