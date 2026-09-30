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
        { job: 'top-up-instances', tasksChecked: tasks, instancesCreated: created, instancesDeleted: deleted },
        'Run complete',
    );
}

main()
    .catch((error) => {
        logger.error({ job: 'top-up-instances', err: error }, 'Run failed');
        process.exit(1);
    })
    .finally(async () => {
        await db.$disconnect();
    });
