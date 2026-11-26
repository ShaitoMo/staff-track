import { AppError } from '@/exceptions/app-error'

export class MediaNotFoundError extends AppError {
    readonly code = 'MEDIA_NOT_FOUND'

    constructor(message = 'Media not found') {
        super(message)
        this.name = 'MediaNotFoundError'
    }
}
