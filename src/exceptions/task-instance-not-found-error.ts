export class TaskInstanceNotFoundError extends Error {
    constructor(message = 'Task instance not found') {
        super(message)
        this.name = 'TaskInstanceNotFoundError'
    }
}
