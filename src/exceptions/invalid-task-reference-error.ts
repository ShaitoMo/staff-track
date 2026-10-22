export class InvalidTaskReferenceError extends Error {
    constructor(message = 'The shelf-guide reference must be an active section, or folder in it, at this branch') {
        super(message)
        this.name = 'InvalidTaskReferenceError'
    }
}
