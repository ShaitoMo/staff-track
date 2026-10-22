import { canEditGuide, requireGuideAccess, requireTaskInstanceAccess } from '@/lib/rbac'
import { parseNumericId } from '@/lib/route-utils'
import { GuideImageRecord } from '@/repository/guide-image-repository'
import { TaskInstanceService } from '@/services/task-instance-service'
import { AccessTokenPayload } from '@/types/auth'
import { ForbiddenError } from '@/exceptions/forbidden-error'
import { GuideImageNotFoundError } from '@/exceptions/guide-image-not-found-error'

/**
 * Access to one guide photo's file: the guide's own rule, widened by a task. A photo the guide hides
 * from staff (inactive section or folder) is still served when `?instance=` names an instance the
 * caller may see whose task references this photo's level. Only that level: the task opens no
 * other part of the guide.
 */
export async function requireGuidePhotoAccess(
    user: AccessTokenPayload,
    image: GuideImageRecord,
    instanceParam: string | null,
): Promise<void> {
    // editors already see hidden photos, so only staff need the task looked up
    const viaTask = !image.visibleToStaff && !canEditGuide(user) && instanceParam !== null
        && await taskShowsPhoto(user, image, instanceParam)

    requireGuideAccess(user, viaTask ? { ...image, visibleToStaff: true } : image, GuideImageNotFoundError)
}

async function taskShowsPhoto(user: AccessTokenPayload, image: GuideImageRecord, instanceParam: string): Promise<boolean> {
    const instanceId = parseNumericId(instanceParam)
    const instance = instanceId === null ? null : await TaskInstanceService.getTaskInstanceById(instanceId)
    const reference = instance?.task.reference

    if (!instance || !reference
        || reference.branch_section_id !== image.view.branchSectionId
        || reference.folder_id !== image.view.folderId) {
        return false
    }

    try {
        await requireTaskInstanceAccess(user, instance)
        return true
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return false
        }
        throw error
    }
}
