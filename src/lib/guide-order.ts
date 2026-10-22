/** A photo level is (section, folder); within one section the folder id alone identifies it, null being the root. */
export type GuideLevel = number | null

/** True when `requested` names exactly the ids in `current`, each once. */
export function isSameIdSet(requested: number[], current: number[]): boolean {
    const unique = new Set(requested)
    return unique.size === requested.length
        && unique.size === current.length
        && current.every(id => unique.has(id))
}
