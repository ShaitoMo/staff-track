import { NextResponse } from 'next/server'
import { forbiddenResponse } from '@/lib/route-utils'
import { InvalidPhotoError } from '@/lib/storage'
import { logger } from '@/lib/logger'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { BranchSectionNotFoundError } from '@/exceptions/branch-section-not-found-error'
import { DuplicateBranchSectionError } from '@/exceptions/duplicate-branch-section-error'
import { DuplicateSectionTypeNameError } from '@/exceptions/duplicate-section-type-name-error'
import { GuideFolderNotFoundError } from '@/exceptions/guide-folder-not-found-error'
import { GuideImageNotFoundError } from '@/exceptions/guide-image-not-found-error'
import { GuidePhotoKeyInUseError } from '@/exceptions/guide-photo-key-in-use-error'
import { InactiveGuideParentError } from '@/exceptions/inactive-guide-parent-error'
import { InvalidGuideOrderError } from '@/exceptions/invalid-guide-order-error'
import { SectionTypeNotFoundError } from '@/exceptions/section-type-not-found-error'

const STATUS_BY_ERROR: [new () => Error, number][] = [
    [BranchNotFoundError, 404],
    [SectionTypeNotFoundError, 404],
    [BranchSectionNotFoundError, 404],
    [GuideFolderNotFoundError, 404],
    [GuideImageNotFoundError, 404],
    [DuplicateSectionTypeNameError, 409],
    [DuplicateBranchSectionError, 409],
    [InactiveGuideParentError, 409],
    [GuidePhotoKeyInUseError, 409],
    [InvalidGuideOrderError, 400],
]

/** The catch every shelf-guide route shares: known errors to their status, anything else logged as a 500. */
export function guideErrorResponse(error: unknown, failureMessage: string): NextResponse {
    const forbidden = forbiddenResponse(error)
    if (forbidden) {
        return forbidden
    }

    if (error instanceof InvalidPhotoError) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const match = STATUS_BY_ERROR.find(([ErrorClass]) => error instanceof ErrorClass)
    if (match) {
        return NextResponse.json({ error: (error as Error).message }, { status: match[1] })
    }

    logger.error({ err: error }, failureMessage)
    return NextResponse.json({ error: failureMessage }, { status: 500 })
}

/** `?name=true` query flags (includeInactive). */
export function queryFlag(url: URL, name: string): boolean {
    return url.searchParams.get(name) === 'true'
}

/** `?folderId=` / `?parentFolderId=`: absent or empty means the section root; anything else must be a numeric id. */
export function queryFolderId(url: URL, name: string): number | null | undefined {
    const value = url.searchParams.get(name)
    if (value === null || value === '') {
        return null
    }
    return /^\d+$/.test(value) ? Number(value) : undefined
}
