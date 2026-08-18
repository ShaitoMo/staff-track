import { MediaRepository } from '@/repository/media-repository'
import { TaskInstanceRepository } from '@/repository/task-instance-repository'
import { MediaRecordView } from '@/types/media'
import { TaskInstanceNotFoundError } from '@/exceptions/task-instance-not-found-error'
import { MediaNotFoundError } from '@/exceptions/media-not-found-error'

export class MediaService {
    /**
     * Every photo attached to one occurrence.
     *
     * The instance is checked first so a bad id reads as 404 rather than an empty list — an
     * instance with no photos yet and an instance that does not exist look identical otherwise.
     * `getInstanceForWrite` is a minimal select already used purely as an existence check
     * elsewhere (`TaskInstanceService.loadForWrite`); reused here rather than adding a second one.
     */
    static async getMediaForInstance(instanceId: number): Promise<MediaRecordView[]> {
        const instance = await TaskInstanceRepository.getInstanceForWrite(instanceId)

        if (!instance) {
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
