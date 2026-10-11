export class BranchNotFoundError extends Error {
    constructor(message = 'Branch not found') {
        super(message)
        this.name = 'BranchNotFoundError'
    }
}
