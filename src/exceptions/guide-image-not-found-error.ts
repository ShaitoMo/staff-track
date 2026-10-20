export class GuideImageNotFoundError extends Error {
    constructor(message = 'Photo not found') {
        super(message)
        this.name = 'GuideImageNotFoundError'
    }
}
