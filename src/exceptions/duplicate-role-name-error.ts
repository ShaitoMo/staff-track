export class DuplicateRoleNameError extends Error {
    constructor(message = 'Role with this name already exists') {
        super(message)
        this.name = 'DuplicateRoleNameError'
    }
}
