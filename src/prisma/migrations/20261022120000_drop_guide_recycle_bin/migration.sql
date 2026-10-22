-- Guide photos are deleted for good, row and files; there is no recycle bin. Anything still in it
-- comes back as a live photo (its files are still in the bucket); deleting it again removes it for good.
ALTER TABLE "guide_images" DROP CONSTRAINT "guide_images_deleted_consistency";
ALTER TABLE "guide_images" DROP CONSTRAINT "guide_images_purged_requires_deleted";

ALTER TABLE "guide_images" DROP COLUMN "is_deleted",
DROP COLUMN "deleted_at",
DROP COLUMN "files_purged_at";
