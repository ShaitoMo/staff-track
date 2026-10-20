import { z } from 'zod'

// Shelf guide (FR12): section types → branch sections → folders → reference photos.

/** Position within a level; bounded so a stray value is a 400, not a Postgres int overflow. */
const DisplayOrderSchema = z.number().int().min(0).max(9999)

const atLeastOneField = (data: object) => Object.values(data).some(value => value !== undefined)

// ---------- Section types (owner's catalogue) ----------

export const CreateSectionTypeSchema = z.object({
    name: z.string().trim().min(1).max(128),
    displayOrder: DisplayOrderSchema.optional(),
})

export type CreateSectionTypeInput = z.infer<typeof CreateSectionTypeSchema>

/** `isActive` is a plain flag here: a section type's deactivation never cascades. */
export const UpdateSectionTypeSchema = z.object({
    name: z.string().trim().min(1).max(128).optional(),
    displayOrder: DisplayOrderSchema.optional(),
    isActive: z.boolean().optional(),
}).refine(atLeastOneField, { message: 'At least one field must be provided' })

export type UpdateSectionTypeInput = z.infer<typeof UpdateSectionTypeSchema>

export interface SectionTypeView {
    sectionTypeId: number
    name: string
    displayOrder: number
    isActive: boolean
}

// ---------- Branch sections ----------

export const CreateBranchSectionSchema = z.object({
    sectionTypeId: z.number().int().positive(),
    displayOrder: DisplayOrderSchema.optional(),
})

export type CreateBranchSectionInput = z.infer<typeof CreateBranchSectionSchema>

/** Deactivate is DELETE and reactivate is its own route, so a cascade can't be skipped through an edit. */
export const UpdateBranchSectionSchema = z.object({
    displayOrder: DisplayOrderSchema,
})

export type UpdateBranchSectionInput = z.infer<typeof UpdateBranchSectionSchema>

export interface BranchSectionView {
    branchSectionId: number
    branchId: number
    sectionTypeId: number
    name: string // the section type's name
    displayOrder: number
    isActive: boolean
}

// ---------- Folders ----------

export const CreateGuideFolderSchema = z.object({
    name: z.string().trim().min(1).max(200),
    parentFolderId: z.number().int().positive().nullable().optional(), // omitted or null = section root
})

export type CreateGuideFolderInput = z.infer<typeof CreateGuideFolderSchema>

export const UpdateGuideFolderSchema = z.object({
    name: z.string().trim().min(1).max(200).optional(),
    displayOrder: DisplayOrderSchema.optional(),
}).refine(atLeastOneField, { message: 'At least one field must be provided' })

export type UpdateGuideFolderInput = z.infer<typeof UpdateGuideFolderSchema>

export interface GuideFolderView {
    folderId: number
    branchSectionId: number
    parentFolderId: number | null
    name: string
    displayOrder: number
    isActive: boolean
}

// ---------- Deactivate / reactivate ----------

export interface DeactivationImpact {
    folders: number // active folders that will go inactive
    images: number // live photos that will go to the recycle bin
}

export interface ReactivationImpact {
    folders: number // inactive folders that will come back
    images: number // recycled photos that come back with restoreImages=true
    permanentlyLost: number // recycled photos already purged; never restored
}

// ---------- Photos ----------

/** A present blank title clears it; an absent one leaves it alone. */
const TitleSchema = z.string().trim().max(200).nullable().transform(title => title || null)

export interface GuideUploadView {
    photo: { key: string; uploadUrl: string }
    thumb: { key: string; uploadUrl: string }
}

export const CreateGuideImageSchema = z.object({
    photoKey: z.string().min(1),
    thumbKey: z.string().min(1),
    title: TitleSchema.optional(),
    folderId: z.number().int().positive().nullable().optional(), // omitted or null = section root
})

export type CreateGuideImageInput = z.infer<typeof CreateGuideImageSchema>

/** Sending photoKey + thumbKey (from a fresh photo-upload) replaces the files and bumps `version`. */
export const UpdateGuideImageSchema = z.object({
    title: TitleSchema.optional(),
    photoKey: z.string().min(1).optional(),
    thumbKey: z.string().min(1).optional(),
}).refine(atLeastOneField, {
    message: 'At least one field must be provided',
}).refine(data => (data.photoKey === undefined) === (data.thumbKey === undefined), {
    message: 'Send photoKey and thumbKey together',
    path: ['thumbKey'],
})

export type UpdateGuideImageInput = z.infer<typeof UpdateGuideImageSchema>

/** Must list exactly the live photos at that level; positions are the array order, 0-based. */
export const ReorderGuideImagesSchema = z.object({
    imageIds: z.array(z.number().int().positive()),
})

export type ReorderGuideImagesInput = z.infer<typeof ReorderGuideImagesSchema>

export interface GuideImageView {
    imageId: number
    branchSectionId: number
    folderId: number | null
    title: string | null
    displayOrder: number
    version: number
    isDeleted: boolean
    deletedAt: string | null
    fileUrl: string // ?v=version, so a replaced photo is never served from a stale cache
    thumbUrl: string
}
