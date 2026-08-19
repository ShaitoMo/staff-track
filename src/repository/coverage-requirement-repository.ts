import { Prisma, CoverageRequirement as CoverageRequirementRow, Role as RoleRow, ShiftPeriod as ShiftPeriodRow } from '@prisma/client'
import { db } from '@/lib/db'
import { CoverageRequirementView, CreateCoverageRequirementInput, UpdateCoverageRequirementInput } from '@/types/coverage-requirement'
import { CoverageRequirementNotFoundError } from '@/exceptions/coverage-requirement-not-found-error'
import { DuplicateCoverageRequirementError } from '@/exceptions/duplicate-coverage-requirement-error'

type RequirementWithRelations = CoverageRequirementRow & { role: RoleRow; period: ShiftPeriodRow }

export class CoverageRequirementRepository {
    /** For a branch's roles × periods grid: role and period expanded, ordered for a stable render. */
    static async getRequirementsByBranch(branchId: number): Promise<CoverageRequirementView[]> {
        const requirements = await db.coverageRequirement.findMany({
            where: { branchId },
            include: { role: true, period: true },
            orderBy: [{ periodId: 'asc' }, { roleId: 'asc' }],
        })

        return requirements.map(CoverageRequirementRepository.toView)
    }

    static async createRequirement(data: CreateCoverageRequirementInput): Promise<CoverageRequirementView> {
        try {
            const requirement = await db.coverageRequirement.create({
                data: {
                    branchId: data.branchId,
                    roleId: data.roleId,
                    periodId: data.periodId,
                    requiredCount: data.requiredCount,
                },
                include: { role: true, period: true },
            })

            return CoverageRequirementRepository.toView(requirement)
        } catch (error: unknown) {
            // The service has already checked branch/role/period existence and the branch match, so
            // the only thing left that can still fail here is the (branchId, roleId, periodId)
            // uniqueness — a duplicate is refused, never silently upserted.
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new DuplicateCoverageRequirementError()
            }
            throw error
        }
    }

    static async updateRequirement(
        requirementId: number,
        data: UpdateCoverageRequirementInput,
    ): Promise<CoverageRequirementView> {
        try {
            const requirement = await db.coverageRequirement.update({
                where: { requirementId },
                data: { requiredCount: data.requiredCount },
                include: { role: true, period: true },
            })

            return CoverageRequirementRepository.toView(requirement)
        } catch (error: unknown) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw new CoverageRequirementNotFoundError()
            }
            throw error
        }
    }

    static async deleteRequirement(requirementId: number): Promise<void> {
        try {
            await db.coverageRequirement.delete({ where: { requirementId } })
        } catch (error: unknown) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw new CoverageRequirementNotFoundError()
            }
            throw error
        }
    }

    private static toView(requirement: RequirementWithRelations): CoverageRequirementView {
        return {
            requirementId: requirement.requirementId,
            branchId: requirement.branchId,
            requiredCount: requirement.requiredCount,
            role: {
                roleId: requirement.role.roleId,
                name: requirement.role.name,
            },
            period: {
                periodId: requirement.period.periodId,
                branchId: requirement.period.branchId,
                name: requirement.period.name,
                defaultStart: CoverageRequirementRepository.toTimeOnlyString(requirement.period.defaultStart),
                defaultEnd: CoverageRequirementRepository.toTimeOnlyString(requirement.period.defaultEnd),
                sortOrder: requirement.period.sortOrder,
            },
        }
    }

    private static toTimeOnlyString(time: Date): string {
        return time.toISOString().slice(11, 16)
    }
}
