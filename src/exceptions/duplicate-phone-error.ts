export class DuplicatePhoneError extends Error {
    constructor(message = 'User with this phone number already exists') {
        super(message)
        this.name = 'DuplicatePhoneError'
    }
}
