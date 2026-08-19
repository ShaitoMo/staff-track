/*
  Warnings:

  - You are about to drop the column `period_id` on the `shifts` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "shifts" DROP CONSTRAINT "shifts_period_id_fkey";

-- AlterTable
ALTER TABLE "shifts" DROP COLUMN "period_id";
