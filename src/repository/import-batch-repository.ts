import { ImportBatch as ImportBatchRow } from "@prisma/client";
import { db } from "@/lib/db";
import { ImportBatchView } from "@/types/import-batch";

export class ImportBatchRepository {
    /** Newest first: an audit trail is read from the most recent upload backwards. */
    static async getImportBatches(): Promise<ImportBatchView[]> {
        const batches = await db.importBatch.findMany({
            orderBy: [{ importedAt: 'desc' }, { batchId: 'desc' }],
        });

        return batches.map(ImportBatchRepository.toView);
    }

    private static toView(batch: ImportBatchRow): ImportBatchView {
        return {
            batch_id: batch.batchId,
            file_name: batch.fileName,
            imported_by: batch.importedBy,
            imported_at: batch.importedAt,
            row_count: batch.rowCount,
        };
    }
}
