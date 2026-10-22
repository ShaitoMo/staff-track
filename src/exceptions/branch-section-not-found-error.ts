export class BranchSectionNotFoundError extends Error {
    constructor(message = 'Section not found') {
        super(message)
        this.name = 'BranchSectionNotFoundError'
    }
}
