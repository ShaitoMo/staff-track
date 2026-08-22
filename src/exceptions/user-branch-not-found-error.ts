export class UserBranchNotFoundError extends Error {
    constructor(message = 'User is not assigned to this branch') {
        super(message)
        this.name = 'UserBranchNotFoundError'
    }
}
