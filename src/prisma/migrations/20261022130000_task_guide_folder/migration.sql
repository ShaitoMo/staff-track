-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "guide_folder_id" INTEGER;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_branch_section_id_guide_folder_id_fkey" FOREIGN KEY ("branch_section_id", "guide_folder_id") REFERENCES "guide_folders"("branch_section_id", "folder_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written: MATCH SIMPLE skips the FK above when branch_section_id is NULL, so a folder alone would go unchecked.
ALTER TABLE tasks ADD CONSTRAINT tasks_guide_folder_requires_section
  CHECK (guide_folder_id IS NULL OR branch_section_id IS NOT NULL);
