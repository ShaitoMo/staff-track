/*
  Warnings:

  - The `source` column on the `attendance` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `task_instances` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `origin` column on the `tasks` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `machine_employee_id` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[branch_id,machine_employee_id]` on the table `user_branches` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "task_status" AS ENUM ('pending', 'completed', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "task_origin" AS ENUM ('assigned', 'self');

-- CreateEnum
CREATE TYPE "attendance_source" AS ENUM ('csv_import', 'machine', 'manual');

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_assigned_to_fkey";

-- AlterTable
ALTER TABLE "attendance" DROP COLUMN "source",
ADD COLUMN     "source" "attendance_source" NOT NULL DEFAULT 'csv_import';

-- AlterTable
ALTER TABLE "branches" ALTER COLUMN "name" SET DATA TYPE VARCHAR,
ALTER COLUMN "location" SET DATA TYPE VARCHAR;

-- AlterTable
ALTER TABLE "import_batches" ALTER COLUMN "file_name" SET DATA TYPE VARCHAR;

-- AlterTable
ALTER TABLE "media" ALTER COLUMN "file_path" SET DATA TYPE VARCHAR;

-- AlterTable
ALTER TABLE "registers" ALTER COLUMN "name" SET DATA TYPE VARCHAR;

-- AlterTable
ALTER TABLE "roles" ALTER COLUMN "name" SET DATA TYPE VARCHAR;

-- AlterTable
ALTER TABLE "task_instances" ADD COLUMN     "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
DROP COLUMN "status",
ADD COLUMN     "status" "task_status" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "assigned_role_id" INTEGER,
ADD COLUMN     "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "title" SET DATA TYPE VARCHAR,
ALTER COLUMN "assigned_to" DROP NOT NULL,
DROP COLUMN "origin",
ADD COLUMN     "origin" "task_origin" NOT NULL DEFAULT 'assigned',
ALTER COLUMN "recurrence" SET DATA TYPE VARCHAR;

-- AlterTable
ALTER TABLE "user_branches" ADD COLUMN     "machine_employee_id" VARCHAR;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "machine_employee_id",
ALTER COLUMN "name" SET DATA TYPE VARCHAR,
ALTER COLUMN "phone" SET DATA TYPE VARCHAR,
ALTER COLUMN "password_hash" SET DATA TYPE VARCHAR;

-- DropEnum
DROP TYPE "AttendanceSource";

-- DropEnum
DROP TYPE "TaskOrigin";

-- DropEnum
DROP TYPE "TaskStatus";

-- CreateIndex
CREATE UNIQUE INDEX "user_branches_branch_id_machine_employee_id_key" ON "user_branches"("branch_id", "machine_employee_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_role_id_fkey" FOREIGN KEY ("assigned_role_id") REFERENCES "roles"("role_id") ON DELETE SET NULL ON UPDATE CASCADE;
