/*
  Warnings:

  - A unique constraint covering the columns `[task_id,due_date]` on the table `task_instances` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "task_instances_task_id_due_date_key" ON "task_instances"("task_id", "due_date");
