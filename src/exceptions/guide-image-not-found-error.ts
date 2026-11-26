import { AppError } from '@/exceptions/app-error'

export class GuideImageNotFoundError extends AppError {
    readonly code = 'PHOTO_NOT_FOUND'

    constructor(message = 'Photo not found') {
        super(message)
        this.name = 'GuideImageNotFoundError'
    }
}
