import { AppError } from '@/exceptions/app-error'

export class BranchSectionNotFoundError extends AppError {
    readonly code = 'SECTION_NOT_FOUND'

    constructor(message = 'Section not found') {
        super(message)
        this.name = 'BranchSectionNotFoundError'
    }
}
