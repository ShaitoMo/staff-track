import { AppError } from '@/exceptions/app-error'

export class SectionTypeNotFoundError extends AppError {
    readonly code = 'SECTION_TYPE_NOT_FOUND'

    constructor(message = 'Section type not found') {
        super(message)
        this.name = 'SectionTypeNotFoundError'
    }
}
