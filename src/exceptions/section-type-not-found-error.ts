export class SectionTypeNotFoundError extends Error {
    constructor(message = 'Section type not found') {
        super(message)
        this.name = 'SectionTypeNotFoundError'
    }
}
