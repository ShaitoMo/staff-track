/**
 * Daily top-up job — run from cron: `npm run job:top-up`
 *
 * Extends every active recurring task's instances to cover [today, today + WINDOW_DAYS].
 * Because the window is re-filled in full each run and UNIQUE (task_id, due_date) absorbs the
 * overlap, running it twice — or late, or twice on the same day — changes nothing extra.
 */
import 'dotenv/config';
import { TaskService } from '@/services/task-service';
import { db } from '@/lib/db';

async function main() {
    const startedAt = new Date();
    const { tasks, created } = await TaskService.topUpRecurringInstances(startedAt);

    console.log(
        `[top-up] ${startedAt.toISOString()} — ${tasks} recurring task(s) checked, ${created} new instance(s) created`,
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
