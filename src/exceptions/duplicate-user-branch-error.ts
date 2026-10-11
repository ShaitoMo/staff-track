export class DuplicateUserBranchError extends Error {
    constructor(message = 'User is already assigned to this branch') {
        super(message)
        this.name = 'DuplicateUserBranchError'
    }
}
