-- A period can be turned off instead of deleted: delete is refused while any shift or coverage
-- requirement references it, so this is how a period in use is retired. Existing periods stay on.
ALTER TABLE "shift_periods" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
