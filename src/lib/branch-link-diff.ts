export interface BranchLinkInput {
    branchId: number;
    machineEmployeeId?: string;
}

export interface BranchLinkDiff {
    toAdd: BranchLinkInput[];
    toRemove: number[];
    toUpdate: BranchLinkInput[];
}

/**
 * Computes the POST/DELETE calls that turn `current` into `desired`. There is no endpoint to
 * update an existing link's machineEmployeeId in place (POST /api/user-branches is create-only,
 * rejected as a duplicate if the link already exists), so a branch that stays linked but whose
 * machineEmployeeId changed comes back in `toUpdate` — the caller removes then re-adds it.
 */
export function diffBranchLinks(current: BranchLinkInput[], desired: BranchLinkInput[]): BranchLinkDiff {
    const currentById = new Map(current.map((link) => [link.branchId, link]));
    const desiredById = new Map(desired.map((link) => [link.branchId, link]));

    const toAdd: BranchLinkInput[] = [];
    const toUpdate: BranchLinkInput[] = [];

    for (const link of desired) {
        const existing = currentById.get(link.branchId);
        if (!existing) {
            toAdd.push(link);
        } else if ((existing.machineEmployeeId ?? '') !== (link.machineEmployeeId ?? '')) {
            toUpdate.push(link);
        }
    }

    const toRemove: number[] = [];
    for (const link of current) {
        if (!desiredById.has(link.branchId)) {
            toRemove.push(link.branchId);
        }
    }

    return { toAdd, toRemove, toUpdate };
}
