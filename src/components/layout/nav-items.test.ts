import { navGroupsFor } from "./nav-items";

function items(isOwner: boolean) {
    return navGroupsFor(isOwner).flatMap((group) => group.items);
}

function hrefs(isOwner: boolean): string[] {
    return items(isOwner).map((item) => item.href);
}

describe("navGroupsFor — the owner/manager sidebar", () => {
    it("leaves Section types out of a Manager's sidebar", () => {
        expect(hrefs(false)).not.toContain("/section-types");
    });

    it("shows a Manager the roles page as Coverage, since they can only change coverage there", () => {
        expect(items(false).find((item) => item.href === "/roles")?.label).toBe("coverage");
    });

    it("keeps the setup a Manager can use", () => {
        expect(hrefs(false)).toEqual(expect.arrayContaining(["/users", "/branches", "/registers", "/periods", "/scheduling-rules"]));
    });

    it("gives the Owner every section, under its own name", () => {
        expect(hrefs(true)).toEqual([
            "/", "/schedule", "/attendance", "/tasks", "/guide",
            "/users", "/branches", "/registers", "/periods", "/roles", "/scheduling-rules", "/section-types",
        ]);
        expect(items(true).find((item) => item.href === "/roles")?.label).toBe("roles");
    });
});
