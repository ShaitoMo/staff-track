-- AlterTable
ALTER TABLE "shifts" ADD COLUMN     "period_id" INTEGER;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "shift_periods"("period_id") ON DELETE SET NULL ON UPDATE CASCADE;
