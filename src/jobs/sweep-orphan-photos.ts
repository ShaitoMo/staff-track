/**
 * Daily cleanup job — run from cron: `npm run job:sweep-photos`. Deletes task photos in R2 that no
 * media row points at, once they are a day old (see MediaService.sweepOrphanPhotos). Idempotent —
 * safe to rerun or run late.
 */
import 'dotenv/config';
import { MediaService } from '@/services/media-service';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

async function main() {
    const { checked, deleted } = await MediaService.sweepOrphanPhotos(new Date());

    logger.info({ job: 'sweep-orphan-photos', photosChecked: checked, photosDeleted: deleted }, 'Run complete');
}

main()
    .catch((error) => {
        logger.error({ job: 'sweep-orphan-photos', err: error }, 'Run failed');
        process.exit(1);
    })
    .finally(async () => {
        await db.$disconnect();
    });
