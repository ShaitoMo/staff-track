import { AppError } from '@/exceptions/app-error'

export class DuplicateSectionTypeNameError extends AppError {
    readonly code = 'DUPLICATE_SECTION_TYPE_NAME'
    override readonly field = 'name'

    constructor(message = 'A section type with this name already exists') {
        super(message)
        this.name = 'DuplicateSectionTypeNameError'
    }
}
