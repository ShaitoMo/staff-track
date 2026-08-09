export class RegisterNotFoundError extends Error {
    constructor(message = 'Register not found') {
        super(message)
        this.name = 'RegisterNotFoundError'
    }
}
