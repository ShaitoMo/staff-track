import { MediaRepository } from '@/repository/media-repository'
import { TaskInstanceRepository } from '@/repository/task-instance-repository'
import { MediaRecordView } from '@/types/media'
import { TaskInstanceNotFoundError } from '@/exceptions/task-instance-not-found-error'
import { MediaNotFoundError } from '@/exceptions/media-not-found-error'
import { deletePhoto, listPhotoKeys } from '@/lib/storage'

/** A day: far longer than the 60s upload URL plus completion, so an in-flight upload is never swept. */
const ORPHAN_MIN_AGE_MS = 24 * 60 * 60 * 1000

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

    /** Deletes day-old photos no media row points at (completion never ran, or lost a double-submit race). */
    static async sweepOrphanPhotos(now: Date): Promise<{ checked: number; deleted: number }> {
        const before = new Date(now.getTime() - ORPHAN_MIN_AGE_MS)
        let checked = 0
        let deleted = 0

        for await (const keys of listPhotoKeys(before)) {
            if (keys.length === 0) continue

            const referenced = await MediaRepository.getReferencedFilePaths(keys)
            const orphans = keys.filter((key) => !referenced.has(key))

            for (const key of orphans) {
                await deletePhoto(key)
            }
            checked += keys.length
            deleted += orphans.length
        }

        return { checked, deleted }
    }
}
