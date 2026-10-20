export class InactiveGuideParentError extends Error {
    constructor(message = 'Reactivate the section or parent folder first') {
        super(message)
        this.name = 'InactiveGuideParentError'
    }
}
