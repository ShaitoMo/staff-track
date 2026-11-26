import { AppError } from '@/exceptions/app-error'

export class DuplicateBranchSectionError extends AppError {
    readonly code = 'DUPLICATE_SECTION'
    override readonly field = 'sectionTypeId'

    constructor(message = 'This branch already has that section') {
        super(message)
        this.name = 'DuplicateBranchSectionError'
    }
}
