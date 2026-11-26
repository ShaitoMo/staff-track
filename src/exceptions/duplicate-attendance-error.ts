import { AppError } from '@/exceptions/app-error'

export class DuplicateAttendanceError extends AppError {
    readonly code = 'DUPLICATE_ATTENDANCE'
    override readonly field = 'clock_in'

    constructor(message = 'This user already has a punch recorded at this time') {
        super(message)
        this.name = 'DuplicateAttendanceError'
    }
}
