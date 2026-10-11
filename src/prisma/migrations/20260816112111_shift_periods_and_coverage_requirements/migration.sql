-- CreateTable
CREATE TABLE "shift_periods" (
    "period_id" SERIAL NOT NULL,
    "branch_id" INTEGER,
    "name" VARCHAR NOT NULL,
    "default_start" TIME NOT NULL,
    "default_end" TIME NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "shift_periods_pkey" PRIMARY KEY ("period_id")
);

-- CreateTable
CREATE TABLE "coverage_requirements" (
    "requirement_id" SERIAL NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,
    "period_id" INTEGER NOT NULL,
    "weekday" INTEGER,
    "required_count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "coverage_requirements_pkey" PRIMARY KEY ("requirement_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coverage_requirements_branch_id_role_id_period_id_weekday_key" ON "coverage_requirements"("branch_id", "role_id", "period_id", "weekday");

-- AddForeignKey
ALTER TABLE "shift_periods" ADD CONSTRAINT "shift_periods_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverage_requirements" ADD CONSTRAINT "coverage_requirements_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverage_requirements" ADD CONSTRAINT "coverage_requirements_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverage_requirements" ADD CONSTRAINT "coverage_requirements_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "shift_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------- Constraints Prisma cannot express ----------

-- the every-day rule the @@unique can't reach: Postgres treats NULL weekdays as distinct, so the
-- generated index stops duplicate weekday-specific rules but not duplicate every-day ones.
CREATE UNIQUE INDEX coverage_req_everyday_uniq
  ON coverage_requirements (branch_id, role_id, period_id)
  WHERE weekday IS NULL;

ALTER TABLE coverage_requirements
  ADD CONSTRAINT coverage_req_weekday_range  CHECK (weekday BETWEEN 0 AND 6),
  ADD CONSTRAINT coverage_req_count_positive CHECK (required_count > 0);

-- a period runs inside one day, matching the same rule shifts already hold
ALTER TABLE shift_periods
  ADD CONSTRAINT shift_period_time_order CHECK (default_end > default_start);

-- one 'Morning' per branch, and one chain-wide 'Morning'; split in two because a NULL branch_id
-- would otherwise make every global row distinct from every other.
CREATE UNIQUE INDEX shift_period_branch_name_uniq
  ON shift_periods (branch_id, name) WHERE branch_id IS NOT NULL;

CREATE UNIQUE INDEX shift_period_global_name_uniq
  ON shift_periods (name) WHERE branch_id IS NULL;
