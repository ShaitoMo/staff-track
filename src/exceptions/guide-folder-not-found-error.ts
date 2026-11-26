import { AppError } from '@/exceptions/app-error'

export class GuideFolderNotFoundError extends AppError {
    readonly code = 'FOLDER_NOT_FOUND'

    constructor(message = 'Folder not found') {
        super(message)
        this.name = 'GuideFolderNotFoundError'
    }
}
