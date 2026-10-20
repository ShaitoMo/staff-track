export class GuideFolderNotFoundError extends Error {
    constructor(message = 'Folder not found') {
        super(message)
        this.name = 'GuideFolderNotFoundError'
    }
}
