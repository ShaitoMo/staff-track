export class GuidePhotoKeyInUseError extends Error {
    constructor(message = 'That upload has already been used') {
        super(message)
        this.name = 'GuidePhotoKeyInUseError'
    }
}
