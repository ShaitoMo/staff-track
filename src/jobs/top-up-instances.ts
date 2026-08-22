/**
 * Daily reconcile job — run from cron: `npm run job:top-up`. Extends active recurring tasks'
 * instances forward and prunes stale ones (see TaskService.reconcileInstances); `updateTask` does
 * the same immediately, this is the backstop. Idempotent — safe to rerun or run late.
 */
import 'dotenv/config';
import { TaskService } from '@/services/task-service';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

async function main() {
    const startedAt = new Date();
    const { tasks, created, deleted } = await TaskService.reconcileInstances(startedAt);

    logger.info(
        { tasksChecked: tasks, instancesCreated: created, instancesDeleted: deleted },
        '[top-up] run complete',
    );
}

main()
    .catch((error) => {
        logger.error({ err: error }, '[top-up] failed');
        process.exit(1);
    })
    .finally(async () => {
        await db.$disconnect();
    });
