import { AccessTokenPayload } from '@/types/auth'
import { MediaRecordView } from '@/types/media'
import { MediaService } from '@/services/media-service'
import { TaskInstanceService } from '@/services/task-instance-service'
import { TaskInstanceNotFoundError } from '@/exceptions/task-instance-not-found-error'
import { requireTaskInstanceAccess } from '@/lib/rbac'

/**
 * Loads a photo's record for a caller who may see it: the same rule as its parent task instance.
 * A missing parent is an error, not a pass — the check must not fail open — so both media routes
 * go through here instead of repeating the three steps.
 *
 * Throws MediaNotFoundError, TaskInstanceNotFoundError, or a ForbiddenError subclass.
 */
export async function requireMediaAccess(user: AccessTokenPayload, mediaId: number): Promise<MediaRecordView> {
    const media = await MediaService.getMediaById(mediaId)
    const instance = await TaskInstanceService.getTaskInstanceById(media.task_instance_id)

    if (!instance) {
        throw new TaskInstanceNotFoundError()
    }

    await requireTaskInstanceAccess(user, instance)

    return media
}
