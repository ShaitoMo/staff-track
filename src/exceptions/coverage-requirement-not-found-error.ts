import { AppError } from '@/exceptions/app-error'

export class CoverageRequirementNotFoundError extends AppError {
    readonly code = 'COVERAGE_REQUIREMENT_NOT_FOUND'

    constructor(message = 'Coverage requirement not found') {
        super(message)
        this.name = 'CoverageRequirementNotFoundError'
    }
}
