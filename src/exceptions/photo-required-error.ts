import { AppError } from '@/exceptions/app-error'

export class PhotoRequiredError extends AppError {
    readonly code = 'PHOTO_REQUIRED'

    constructor(message = 'A photo is required to complete a task instance') {
        super(message)
        this.name = 'PhotoRequiredError'
    }
}
