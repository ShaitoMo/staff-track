-- The clock machine can log a clock-out with no clock-in (a missed punch on the way in). Those
-- rows are now imported and flagged rather than rejected, so clock_in may be NULL.
ALTER TABLE "attendance" ALTER COLUMN "clock_in" DROP NOT NULL;

-- Either end identifies a punch. Without this, re-importing a clock-out-only row would duplicate
-- it — and still would after a manager filled in its clock-in, since (user_id, clock_in) then no
-- longer matches the NULL the file carries. NULLs never collide, so open punches are unaffected.
CREATE UNIQUE INDEX "attendance_user_id_clock_out_key" ON "attendance"("user_id", "clock_out");

-- A punch with neither end says nothing.
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_has_an_end" CHECK ("clock_in" IS NOT NULL OR "clock_out" IS NOT NULL);
