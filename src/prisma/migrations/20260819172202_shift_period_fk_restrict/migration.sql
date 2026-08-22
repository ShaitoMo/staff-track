-- DropForeignKey
ALTER TABLE "shifts" DROP CONSTRAINT "shifts_period_id_fkey";

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "shift_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE;
