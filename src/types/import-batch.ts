/**
 * One upload of a clock-machine export. `row_count` is what the upload actually wrote, so a
 * re-upload of a file already imported shows 0 — the batch records that it happened, not that it
 * produced anything.
 */
export interface ImportBatchView {
    batch_id: number;
    file_name: string;
    imported_by: number;
    imported_at: Date;
    row_count: number;
}
