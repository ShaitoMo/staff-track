export class DuplicateBranchSectionError extends Error {
    constructor(message = 'This branch already has that section') {
        super(message)
        this.name = 'DuplicateBranchSectionError'
    }
}
