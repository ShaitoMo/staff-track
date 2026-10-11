/**
 * The branch an owner or manager is looking at, remembered across pages. A preference only:
 * every route still checks branch access, so a stale or edited cookie can't reach anything new.
 */
export const BRANCH_COOKIE = "stafftrack_branch";

/** The cookie value for every branch the viewer runs. */
export const ALL_BRANCHES = "all";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** A `?branch=` param or cookie value as a branch id, or undefined when it isn't one. */
export function parseBranchId(value: string | null | undefined): number | undefined {
    return value && /^\d+$/.test(value) ? Number(value) : undefined;
}

/**
 * Which branch a page shows, undefined meaning every branch: a `?branch=` link wins, then the
 * remembered choice, and someone with a single branch always gets it. 'all', nothing saved, or a
 * branch since taken away all fall through to every branch — never an error.
 */
export function resolveBranchId(
    requested: string | null | undefined,
    preference: string | null | undefined,
    branchIds: number[],
): number | undefined {
    if (branchIds.length === 1) {
        return branchIds[0];
    }

    for (const candidate of [parseBranchId(requested), parseBranchId(preference)]) {
        if (candidate !== undefined && branchIds.includes(candidate)) {
            return candidate;
        }
    }

    return undefined;
}

/** The `document.cookie` string that remembers a choice (a branch id or ALL_BRANCHES) for a year. */
export function branchCookieString(value: string): string {
    return `${BRANCH_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}
