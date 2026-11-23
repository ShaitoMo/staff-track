import { leavingHref } from "@/lib/leave-guard";

const HERE = "http://localhost:3000/tasks/new";
const plainClick = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false };
const link = (href: string, extra: Partial<{ target: string; download: boolean }> = {}) => ({
    href,
    target: extra.target ?? "",
    download: extra.download ?? false,
});

describe("leavingHref", () => {
    it("returns the destination of a plain click on a link to another page in the app", () => {
        expect(leavingHref(plainClick, link("http://localhost:3000/users?branch=2"), HERE)).toBe("/users?branch=2");
    });

    it.each([
        ["a modifier key (new tab or window)", { ...plainClick, ctrlKey: true }, link("/users")],
        ["a middle click", { ...plainClick, button: 1 }, link("/users")],
        ["a link that opens elsewhere", plainClick, link("/users", { target: "_blank" })],
        ["a download link", plainClick, link("/users", { download: true })],
        ["a click something else already handled", { ...plainClick, defaultPrevented: true }, link("/users")],
    ])("stays out of %s, since this page stays open", (_, click, anchor) => {
        expect(leavingHref(click, anchor, HERE)).toBeNull();
    });

    it("stays out of a link to another site, which the browser's own leave prompt covers", () => {
        expect(leavingHref(plainClick, link("https://example.com/help"), HERE)).toBeNull();
    });

    it.each([
        ["the same page", link("http://localhost:3000/tasks/new")],
        ["an anchor on the same page", link("http://localhost:3000/tasks/new#schedule")],
    ])("stays out of a link to %s, since nothing is left", (_, anchor) => {
        expect(leavingHref(plainClick, anchor, HERE)).toBeNull();
    });
});
