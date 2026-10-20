/** A photo level is (section, folder); within one section the folder id alone identifies it, null being the root. */
export type GuideLevel = number | null

/**
 * Positions for photos appended to the end of their own level, in the order given: each append
 * sees the previous one. `maxByLevel` is the highest live position per level; a level missing from
 * it is empty, so its first photo lands at 0.
 */
export function appendToLevels<T extends { folderId: GuideLevel }>(
    items: T[],
    maxByLevel: Map<GuideLevel, number>,
): { item: T; displayOrder: number }[] {
    const next = new Map(maxByLevel)

    return items.map(item => {
        const displayOrder = (next.get(item.folderId) ?? -1) + 1
        next.set(item.folderId, displayOrder)
        return { item, displayOrder }
    })
}

/** True when `requested` names exactly the ids in `current`, each once. */
export function isSameIdSet(requested: number[], current: number[]): boolean {
    const unique = new Set(requested)
    return unique.size === requested.length
        && unique.size === current.length
        && current.every(id => unique.has(id))
}
