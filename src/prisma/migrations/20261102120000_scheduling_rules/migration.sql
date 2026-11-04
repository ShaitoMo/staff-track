-- CreateTable
CREATE TABLE "schedule_keep_apart" (
    "branch_id" INTEGER NOT NULL,
    "user_a_id" INTEGER NOT NULL,
    "user_b_id" INTEGER NOT NULL,

    CONSTRAINT "schedule_keep_apart_pkey" PRIMARY KEY ("branch_id","user_a_id","user_b_id")
);

-- CreateTable
CREATE TABLE "schedule_period_limits" (
    "branch_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "period_id" INTEGER NOT NULL,

    CONSTRAINT "schedule_period_limits_pkey" PRIMARY KEY ("branch_id","user_id","period_id")
);

-- AddForeignKey
ALTER TABLE "schedule_keep_apart" ADD CONSTRAINT "schedule_keep_apart_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_keep_apart" ADD CONSTRAINT "schedule_keep_apart_user_a_id_fkey" FOREIGN KEY ("user_a_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_keep_apart" ADD CONSTRAINT "schedule_keep_apart_user_b_id_fkey" FOREIGN KEY ("user_b_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_period_limits" ADD CONSTRAINT "schedule_period_limits_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_period_limits" ADD CONSTRAINT "schedule_period_limits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_period_limits" ADD CONSTRAINT "schedule_period_limits_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "shift_periods"("period_id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-written: one row per pair, always stored low id first.
ALTER TABLE schedule_keep_apart ADD CONSTRAINT schedule_keep_apart_ordered CHECK (user_a_id < user_b_id);
