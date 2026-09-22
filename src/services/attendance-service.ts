import {
    AttendanceRepository,
    AttendanceFilters,
    ImportedPunch,
} from '@/repository/attendance-repository'
import { BranchRepository } from '@/repository/branch-repository'
import { ImportBatchRepository } from '@/repository/import-batch-repository'
import { UserRepository } from '@/repository/user-repository'
import { UserBranchRepository } from '@/repository/user-branch-repository'
import { AttendanceFiltersInput, AttendanceView, CreateAttendanceInput } from '@/types/attendance'
import { ImportAttendanceInput, ImportAttendanceResult } from '@/types/attendance-import'
import { ImportBatchView } from '@/types/import-batch'
import {
    ImportRowError,
    MAX_IMPORT_BYTES,
    InvalidImportFileError,
    assertImportableFile,
    parseAttendanceWorkbook,
} from '@/lib/attendance-import'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { UserNotAtBranchError } from '@/exceptions/user-not-at-branch-error'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export class AttendanceService {
    static async getAttendance(filters: AttendanceFiltersInput): Promise<AttendanceView[]> {
        const repositoryFilters: AttendanceFilters = {
            userId: filters.user_id,
            branchId: filters.branch_id,
            from: filters.from,
            to: new Date(filters.to.getTime() + MS_PER_DAY),
        }

        return AttendanceRepository.getAttendance(repositoryFilters)
    }

    /**
     * A punch the machine missed. Both checks run before the insert for the reason
     * ShiftService.createShift gives: a foreign-key violation names a constraint, not a field.
     */
    static async createAttendance(data: CreateAttendanceInput): Promise<AttendanceView> {
        await BranchRepository.assertExists(data.branch_id)

        // a missing link and a missing user are the same answer, so this covers user_id too
        const links = await UserBranchRepository.getUserBranches({
            userId: data.user_id,
            branchId: data.branch_id,
        })

        if (links.length === 0) {
            throw new UserNotAtBranchError('User does not work at this branch')
        }

        return AttendanceRepository.createAttendance(data)
    }

    /**
     * A clock-machine export (FR5 v1).
     *
     * A readable file always produces a batch, even when every punch in it fails: the upload is a
     * fact worth recording, and the per-row errors are what the manager needs back. Only a file
     * that cannot be read at all is refused outright.
     */
    static async importAttendance(params: {
        file: File;
        filters: ImportAttendanceInput;
    }): Promise<ImportAttendanceResult> {
        const { file, filters } = params;
        const { branch_id: branchId, imported_by: importedBy } = filters;

        await BranchRepository.assertExists(branchId);
        await AttendanceService.assertImporterExists(importedBy);

        assertImportableFile(file);

        if (file.size === 0) {
            throw new InvalidImportFileError('The uploaded file is empty');
        }

        if (file.size > MAX_IMPORT_BYTES) {
            throw new InvalidImportFileError(
                `The file exceeds the ${MAX_IMPORT_BYTES / (1024 * 1024)}MB limit`,
            );
        }

        const { punches, errors } = parseAttendanceWorkbook(
            Buffer.from(await file.arrayBuffer()),
        );

        const usersByMachineId = await AttendanceService.machineIdsAtBranch(branchId);
        const resolved: ImportedPunch[] = [];

        for (const punch of punches) {
            const userId = usersByMachineId.get(punch.machineEmployeeId);

            if (userId === undefined) {
                errors.push({
                    row: punch.row,
                    message: `No one at this branch has clock-in number '${punch.machineEmployeeId}'${punch.name ? ` (${punch.name})` : ''}`,
                });
                continue;
            }

            // a punch already recorded — whether repeated within this file or from a previous
            // import — shares @@unique([userId, clockIn]) with every other row here, so the
            // insert below is what actually decides duplicate vs. new; nothing is resolved twice
            resolved.push({
                userId,
                branchId,
                clockIn: punch.clockIn,
                clockOut: punch.clockOut,
            });
        }

        const { batchId, created } = await AttendanceRepository.importAttendance({
            fileName: file.name,
            importedBy,
            punches: resolved,
        });

        return {
            batch_id: batchId,
            file_name: file.name,
            punches_read: punches.length,
            records_created: created,
            records_skipped: resolved.length - created,
            errors: AttendanceService.byRow(errors),
        };
    }

    static async getImportBatches(): Promise<ImportBatchView[]> {
        return ImportBatchRepository.getImportBatches()
    }

    private static async machineIdsAtBranch(branchId: number): Promise<Map<string, number>> {
        const links = await UserBranchRepository.getUserBranches({ branchId });

        return new Map(
            links
                .filter((link) => link.machineEmployeeId !== undefined)
                .map((link) => [link.machineEmployeeId as string, link.userId]),
        );
    }

    private static byRow(errors: ImportRowError[]): ImportRowError[] {
        return [...errors].sort((left, right) => left.row - right.row);
    }

    private static async assertImporterExists(userId: number): Promise<void> {
        const user = await UserRepository.getUserById(userId);

        if (!user) {
            throw new UserNotFoundError('imported_by is not an existing user');
        }
    }
}
