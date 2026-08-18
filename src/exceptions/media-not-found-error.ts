export class MediaNotFoundError extends Error {
    constructor(message = 'Media not found') {
        super(message)
        this.name = 'MediaNotFoundError'
    }
}
