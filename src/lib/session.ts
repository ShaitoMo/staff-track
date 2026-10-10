import { cookies, headers } from "next/headers";
import { AUTH_HEADER_BRANCH_IDS, AUTH_HEADER_ROLE, AUTH_HEADER_USER_ID } from "@/lib/auth";
import { BRANCH_COOKIE, resolveBranchId } from "@/lib/branch-selection";
import { AccessTokenPayload } from "@/types/auth";
import { Branch } from "@/types/branch";

/** The top bar's remembered branch, as saved: a branch id, 'all', or undefined. */
export async function getBranchPreference(): Promise<string | undefined> {
    return (await cookies()).get(BRANCH_COOKIE)?.value;
}

/**
 * The branch a page shows (undefined: every branch), out of the branches the API already scoped
 * to this viewer. A `?branch=` param wins over the top bar's remembered choice.
 */
export async function getSelectedBranchId(requested: string | undefined, branches: Branch[]): Promise<number | undefined> {
    return resolveBranchId(requested, await getBranchPreference(), branches.map((branch) => branch.branchId));
}

/** Reads identity off headers proxy.ts already verified for this request — no repeat JWT check, no DB hit. */
export async function getSession(): Promise<AccessTokenPayload | null> {
    const requestHeaders = await headers();
    const userId = requestHeaders.get(AUTH_HEADER_USER_ID);
    const role = requestHeaders.get(AUTH_HEADER_ROLE);
    const branchIdsRaw = requestHeaders.get(AUTH_HEADER_BRANCH_IDS);

    if (!userId || !role || !branchIdsRaw) {
        return null;
    }

    try {
        const branchIds = JSON.parse(branchIdsRaw);

        if (!Array.isArray(branchIds) || !branchIds.every((id): id is number => typeof id === "number")) {
            return null;
        }

        return { userId: Number(userId), role, branchIds };
    } catch {
        return null;
    }
}
