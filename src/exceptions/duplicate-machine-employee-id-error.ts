import { AppError } from '@/exceptions/app-error'

export class DuplicateMachineEmployeeIdError extends AppError {
    readonly code = 'DUPLICATE_MACHINE_EMPLOYEE_ID'
    override readonly field = 'machineEmployeeId'

    constructor(message = 'This machine employee ID is already used in this branch') {
        super(message)
        this.name = 'DuplicateMachineEmployeeIdError'
    }
}
