import type { GuideFolderView } from "@/types/shelf-guide";

/**
 * A section's folders as picker options, each named by its path ("Top shelf › Left") and listed
 * depth-first, so a folder sits right under its parent. Keeps the given sibling order.
 */
export function folderPathOptions(folders: GuideFolderView[]): { folderId: number; label: string }[] {
    const children = new Map<number | null, GuideFolderView[]>();
    for (const folder of folders) {
        children.set(folder.parentFolderId, [...(children.get(folder.parentFolderId) ?? []), folder]);
    }

    const options: { folderId: number; label: string }[] = [];
    const visit = (parentId: number | null, prefix: string) => {
        for (const folder of children.get(parentId) ?? []) {
            const label = prefix === "" ? folder.name : `${prefix} › ${folder.name}`;
            options.push({ folderId: folder.folderId, label });
            visit(folder.folderId, label);
        }
    };
    visit(null, "");

    return options;
}
