export class UserNotAtBranchError extends Error {
    constructor(message = 'Assigned user does not work at this branch') {
        super(message)
        this.name = 'UserNotAtBranchError'
    }
}
