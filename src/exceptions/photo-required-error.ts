export class PhotoRequiredError extends Error {
    constructor(message = 'A photo is required to complete a task instance') {
        super(message)
        this.name = 'PhotoRequiredError'
    }
}
