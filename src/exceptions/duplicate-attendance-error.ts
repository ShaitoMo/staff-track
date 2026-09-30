export class DuplicateAttendanceError extends Error {
    constructor(message = 'This user already has an attendance record at this clock-in time') {
        super(message)
        this.name = 'DuplicateAttendanceError'
    }
}
