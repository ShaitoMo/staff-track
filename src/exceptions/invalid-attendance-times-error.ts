export class InvalidAttendanceTimesError extends Error {
    constructor(message = 'clock_out must be after clock_in') {
        super(message)
        this.name = 'InvalidAttendanceTimesError'
    }
}
