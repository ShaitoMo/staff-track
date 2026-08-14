export class InvalidTaskAssignmentError extends Error {
    constructor(message = 'Invalid assigned_to or assigned_role_id') {
        super(message)
        this.name = 'InvalidTaskAssignmentError'
    }
}
