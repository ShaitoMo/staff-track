-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "branch_section_id" INTEGER;

-- CreateTable
CREATE TABLE "section_types" (
    "section_type_id" SERIAL NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "section_types_pkey" PRIMARY KEY ("section_type_id")
);

-- CreateTable
CREATE TABLE "branch_sections" (
    "branch_section_id" SERIAL NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "section_type_id" INTEGER NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "branch_sections_pkey" PRIMARY KEY ("branch_section_id")
);

-- CreateTable
CREATE TABLE "guide_folders" (
    "folder_id" SERIAL NOT NULL,
    "branch_section_id" INTEGER NOT NULL,
    "parent_folder_id" INTEGER,
    "name" VARCHAR(200) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "guide_folders_pkey" PRIMARY KEY ("folder_id")
);

-- CreateTable
CREATE TABLE "guide_images" (
    "image_id" SERIAL NOT NULL,
    "branch_section_id" INTEGER NOT NULL,
    "folder_id" INTEGER,
    "title" VARCHAR(200),
    "storage_key" VARCHAR NOT NULL,
    "thumb_key" VARCHAR NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploaded_by" INTEGER NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "files_purged_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "guide_images_pkey" PRIMARY KEY ("image_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "branch_sections_branch_id_section_type_id_key" ON "branch_sections"("branch_id", "section_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "branch_sections_branch_id_branch_section_id_key" ON "branch_sections"("branch_id", "branch_section_id");

-- CreateIndex
CREATE INDEX "guide_folders_branch_section_id_parent_folder_id_idx" ON "guide_folders"("branch_section_id", "parent_folder_id");

-- CreateIndex
CREATE UNIQUE INDEX "guide_folders_branch_section_id_folder_id_key" ON "guide_folders"("branch_section_id", "folder_id");

-- CreateIndex
CREATE UNIQUE INDEX "guide_images_storage_key_key" ON "guide_images"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "guide_images_thumb_key_key" ON "guide_images"("thumb_key");

-- CreateIndex
CREATE INDEX "guide_images_branch_section_id_folder_id_idx" ON "guide_images"("branch_section_id", "folder_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_branch_id_branch_section_id_fkey" FOREIGN KEY ("branch_id", "branch_section_id") REFERENCES "branch_sections"("branch_id", "branch_section_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_sections" ADD CONSTRAINT "branch_sections_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_sections" ADD CONSTRAINT "branch_sections_section_type_id_fkey" FOREIGN KEY ("section_type_id") REFERENCES "section_types"("section_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_folders" ADD CONSTRAINT "guide_folders_branch_section_id_fkey" FOREIGN KEY ("branch_section_id") REFERENCES "branch_sections"("branch_section_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_folders" ADD CONSTRAINT "guide_folders_branch_section_id_parent_folder_id_fkey" FOREIGN KEY ("branch_section_id", "parent_folder_id") REFERENCES "guide_folders"("branch_section_id", "folder_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "guide_images" ADD CONSTRAINT "guide_images_branch_section_id_fkey" FOREIGN KEY ("branch_section_id") REFERENCES "branch_sections"("branch_section_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_images" ADD CONSTRAINT "guide_images_branch_section_id_folder_id_fkey" FOREIGN KEY ("branch_section_id", "folder_id") REFERENCES "guide_folders"("branch_section_id", "folder_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_images" ADD CONSTRAINT "guide_images_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Hand-written: what Prisma can't express.
-- Section type names are unique regardless of case.
CREATE UNIQUE INDEX section_types_name_ci ON section_types (lower(name));
ALTER TABLE guide_images ADD CONSTRAINT guide_images_deleted_consistency
  CHECK (is_deleted = (deleted_at IS NOT NULL));
ALTER TABLE guide_images ADD CONSTRAINT guide_images_purged_requires_deleted
  CHECK (files_purged_at IS NULL OR is_deleted);
ALTER TABLE section_types   ADD CONSTRAINT section_types_display_order_nonneg   CHECK (display_order >= 0);
ALTER TABLE branch_sections ADD CONSTRAINT branch_sections_display_order_nonneg CHECK (display_order >= 0);
ALTER TABLE guide_folders   ADD CONSTRAINT guide_folders_display_order_nonneg   CHECK (display_order >= 0);
