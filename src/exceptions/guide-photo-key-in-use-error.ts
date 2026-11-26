import { AppError } from '@/exceptions/app-error'

export class GuidePhotoKeyInUseError extends AppError {
    readonly code = 'PHOTO_KEY_IN_USE'

    constructor(message = 'That upload has already been used') {
        super(message)
        this.name = 'GuidePhotoKeyInUseError'
    }
}
