import { folderPathOptions } from "@/lib/guide-folder-paths";
import type { GuideFolderView } from "@/types/shelf-guide";

const folder = (folderId: number, name: string, parentFolderId: number | null): GuideFolderView => ({
    folderId, branchSectionId: 4, parentFolderId, name, displayOrder: 0, isActive: true,
});

describe("folderPathOptions", () => {
    it("names each folder by its path and lists children right under their parent", () => {
        const options = folderPathOptions([
            folder(1, "Top shelf", null),
            folder(2, "Bottom shelf", null),
            folder(3, "Left", 1),
            folder(4, "Back", 3),
        ]);

        expect(options).toEqual([
            { folderId: 1, label: "Top shelf" },
            { folderId: 3, label: "Top shelf › Left" },
            { folderId: 4, label: "Top shelf › Left › Back" },
            { folderId: 2, label: "Bottom shelf" },
        ]);
    });

    it("leaves out a folder whose parent isn't in the list", () => {
        expect(folderPathOptions([folder(5, "Orphan", 99)])).toEqual([]);
    });
});
