import { MediaRepository } from '@/repository/media-repository'
import { TaskInstanceRepository } from '@/repository/task-instance-repository'
import { MediaRecordView } from '@/types/media'
import { TaskInstanceNotFoundError } from '@/exceptions/task-instance-not-found-error'
import { MediaNotFoundError } from '@/exceptions/media-not-found-error'

export class MediaService {
    /**
     * Every photo attached to one occurrence. Instance is checked first so a bad id reads as 404,
     * not an empty list (indistinguishable otherwise).
     */
    static async getMediaForInstance(instanceId: number): Promise<MediaRecordView[]> {
        const exists = await TaskInstanceRepository.instanceExists(instanceId)

        if (!exists) {
            throw new TaskInstanceNotFoundError()
        }

        return MediaRepository.getMediaForInstance(instanceId)
    }

    static async getMediaById(mediaId: number): Promise<MediaRecordView> {
        const media = await MediaRepository.getMediaById(mediaId)

        if (!media) {
            throw new MediaNotFoundError()
        }

        return media
    }
}
