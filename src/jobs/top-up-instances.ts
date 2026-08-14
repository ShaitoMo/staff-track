/**
 * Daily reconcile job — run from cron: `npm run job:top-up`
 *
 * Extends every active recurring task's instances to cover [today, today + WINDOW_DAYS], then
 * deletes the forward pending rows its rule no longer accounts for, and finally sweeps up the
 * pending rows of tasks that have been deactivated. Recurring tasks only; one-off instances are
 * authored rather than generated and are never touched.
 *
 * `updateTask` already applies the same reconciliation the moment a schedule changes. This run is
 * the backstop: it repairs anything that write missed and carries the window forward a day.
 *
 * Because the window is re-filled in full each run, UNIQUE (task_id, due_date) absorbs the
 * overlap, and the prune only ever matches rows that are still pending, running it twice — or
 * late, or twice on the same day — changes nothing extra.
 */
import 'dotenv/config';
import { TaskService } from '@/services/task-service';
import { db } from '@/lib/db';

async function main() {
    const startedAt = new Date();
    const { tasks, created, deleted } = await TaskService.reconcileInstances(startedAt);

    console.log(
        `[top-up] ${startedAt.toISOString()} — ${tasks} recurring task(s) checked, ` +
        `${created} new instance(s) created, ${deleted} cancelled instance(s) removed`,
    );
}

main()
    .catch((error) => {
        console.error('[top-up] failed', error);
        process.exit(1);
    })
    .finally(async () => {
        await db.$disconnect();
    });
