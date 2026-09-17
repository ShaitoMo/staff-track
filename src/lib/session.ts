import { headers } from "next/headers";
import { AUTH_HEADER_BRANCH_IDS, AUTH_HEADER_ROLE, AUTH_HEADER_USER_ID } from "@/lib/auth";
import { AccessTokenPayload } from "@/types/auth";

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
