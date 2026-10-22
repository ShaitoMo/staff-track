export class DuplicateSectionTypeNameError extends Error {
    constructor(message = 'A section type with this name already exists') {
        super(message)
        this.name = 'DuplicateSectionTypeNameError'
    }
}
