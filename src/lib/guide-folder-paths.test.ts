import { isolate } from "@/i18n/locales";
import { folderPathOptions } from "@/lib/guide-folder-paths";
import type { GuideFolderView } from "@/types/shelf-guide";

const folder = (folderId: number, name: string, parentFolderId: number | null): GuideFolderView => ({
    folderId, branchSectionId: 4, parentFolderId, name, displayOrder: 0, isActive: true,
});

// isolate("") is just the two invisible marks, so their names are readable here
const [FSI, PDI] = isolate("");
const stripIsolates = (text: string) => text.replaceAll(FSI, "").replaceAll(PDI, "");

describe("folderPathOptions", () => {
    it("names each folder by its path and lists children right under their parent", () => {
        const options = folderPathOptions([
            folder(1, "Top shelf", null),
            folder(2, "Bottom shelf", null),
            folder(3, "Left", 1),
            folder(4, "Back", 3),
        ]);

        expect(options.map((option) => [option.folderId, stripIsolates(option.label)])).toEqual([
            [1, "Top shelf"],
            [3, "Top shelf › Left"],
            [4, "Top shelf › Left › Back"],
            [2, "Bottom shelf"],
        ]);
    });

    it("isolates each folder name, so an English name in an Arabic path keeps the arrows in place", () => {
        const [, child] = folderPathOptions([folder(1, "الرف العلوي", null), folder(2, "Left", 1)]);

        expect(child.label).toBe(`${FSI}الرف العلوي${PDI} › ${FSI}Left${PDI}`);
    });

    it("leaves out a folder whose parent isn't in the list", () => {
        expect(folderPathOptions([folder(5, "Orphan", 99)])).toEqual([]);
    });
});
