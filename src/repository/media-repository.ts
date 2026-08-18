import { Media as MediaRow } from "@prisma/client";
import { db } from "@/lib/db";
import { MediaRecordView } from "@/types/media";

export class MediaRepository {
    /** Every photo on one occurrence, newest first — same ordering as the instance's own `media[]`. */
    static async getMediaForInstance(instanceId: number): Promise<MediaRecordView[]> {
        const media = await db.media.findMany({
            where: { taskInstanceId: instanceId },
            orderBy: { serverTimestamp: 'desc' },
        });

        return media.map(MediaRepository.toView);
    }

    static async getMediaById(mediaId: number): Promise<MediaRecordView | null> {
        const media = await db.media.findUnique({
            where: { mediaId },
        });

        return media ? MediaRepository.toView(media) : null;
    }

    private static toView(media: MediaRow): MediaRecordView {
        return {
            media_id: media.mediaId,
            task_instance_id: media.taskInstanceId,
            file_path: media.filePath,
            uploaded_by: media.uploadedBy,
            server_timestamp: media.serverTimestamp,
        };
    }
}
