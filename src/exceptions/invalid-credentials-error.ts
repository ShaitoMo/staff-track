export class InvalidCredentialsError extends Error {
    constructor(message = 'Invalid phone or password') {
        super(message)
        this.name = 'InvalidCredentialsError'
    }
}
