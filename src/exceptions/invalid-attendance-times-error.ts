import { AppError } from '@/exceptions/app-error'

export class InvalidAttendanceTimesError extends AppError {
    readonly code = 'INVALID_ATTENDANCE_TIMES'
    override readonly field = 'clock_out'

    constructor(message = 'clock_out must be after clock_in') {
        super(message)
        this.name = 'InvalidAttendanceTimesError'
    }
}
