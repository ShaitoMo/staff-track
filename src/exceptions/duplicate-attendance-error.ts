export class DuplicateAttendanceError extends Error {
    constructor(message = 'This user already has a punch recorded at this time') {
        super(message)
        this.name = 'DuplicateAttendanceError'
    }
}
