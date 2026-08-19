/*
  Warnings:

  - You are about to drop the column `weekday` on the `coverage_requirements` table. All the data in the column will be lost.

*/
-- DropIndex — the old 4-column unique inferred from @@unique([branchId, roleId, periodId, weekday])
DROP INDEX "coverage_requirements_branch_id_role_id_period_id_weekday_key";

-- DropIndex — the partial "every-day" unique from when weekday was nullable (see
-- 20260816112111_shift_periods_and_coverage_requirements). Dropping the weekday column below would
-- cascade-drop this anyway since its predicate references that column; dropped explicitly first so
-- the intent isn't left implicit. coverage_req_weekday_range, the CHECK on the same column, is
-- cascade-dropped by Postgres along with the column itself.
DROP INDEX IF EXISTS "coverage_req_everyday_uniq";

-- AlterTable
ALTER TABLE "coverage_requirements" DROP COLUMN "weekday";

-- AlterTable
ALTER TABLE "shifts" ADD COLUMN     "period_id" INTEGER;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "shift_periods"("period_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex — a full (non-partial) unique now that weekday no longer varies a row's identity:
-- one row per (branch, role, period).
CREATE UNIQUE INDEX "coverage_requirements_branch_id_role_id_period_id_key" ON "coverage_requirements"("branch_id", "role_id", "period_id");

-- ---------- Constraints Prisma cannot express ----------

-- required_count = 0 is meaningful ("explicitly not needed"), which the original constraint
-- refused to store at all.
ALTER TABLE "coverage_requirements"
  DROP CONSTRAINT "coverage_req_count_positive";

ALTER TABLE "coverage_requirements"
  ADD CONSTRAINT "coverage_req_count_nonnegative" CHECK (required_count >= 0);
