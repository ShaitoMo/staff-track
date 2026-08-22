export class DuplicateMachineEmployeeIdError extends Error {
    constructor(message = 'This machine employee ID is already used in this branch') {
        super(message)
        this.name = 'DuplicateMachineEmployeeIdError'
    }
}
