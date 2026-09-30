export class InvalidRoleError extends Error {
    constructor(message = 'Invalid roleId') {
        super(message)
        this.name = 'InvalidRoleError'
    }
}
