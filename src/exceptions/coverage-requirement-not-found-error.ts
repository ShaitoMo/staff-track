export class CoverageRequirementNotFoundError extends Error {
    constructor(message = 'Coverage requirement not found') {
        super(message)
        this.name = 'CoverageRequirementNotFoundError'
    }
}
