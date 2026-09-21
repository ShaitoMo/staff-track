-- Shifts can now be scheduled from a named period (shift_periods.period_id), which supplies the
-- shift's default start/end when the caller does not name times directly.
ALTER TABLE "shifts" ADD COLUMN "period_id" INTEGER;

-- Deleting a referenced period must be refused (409), not silently drop off the shifts scheduled
-- from it.
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "shift_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Coverage requirements no longer vary by weekday: every requirement now applies to every day,
-- which the read path (resolveCoverageGaps) treats as a plain cross-join against the requested
-- week's dates. Dropping the column cascade-drops coverage_req_weekday_range, the CHECK on it.
DROP INDEX "coverage_requirements_branch_id_role_id_period_id_weekday_key";
DROP INDEX IF EXISTS "coverage_req_everyday_uniq";
ALTER TABLE "coverage_requirements" DROP COLUMN "weekday";

-- One row per (branch, role, period) now that weekday no longer varies a row's identity.
CREATE UNIQUE INDEX "coverage_requirements_branch_id_role_id_period_id_key" ON "coverage_requirements"("branch_id", "role_id", "period_id");

-- required_count = 0 is meaningful ("explicitly not needed"), which the original constraint
-- refused to store at all.
ALTER TABLE "coverage_requirements" DROP CONSTRAINT "coverage_req_count_positive";
ALTER TABLE "coverage_requirements" ADD CONSTRAINT "coverage_req_count_nonnegative" CHECK (required_count >= 0);
