export class InvalidGuideOrderError extends Error {
    constructor(message = 'The order must list exactly the photos at this level') {
        super(message)
        this.name = 'InvalidGuideOrderError'
    }
}
