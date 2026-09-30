/**
 * An attempt to change a task's kind. A task is one-off or recurring from creation, and PATCH
 * cannot move it either way (-> 400).
 *
 * Recurring -> one-off has no date to land on: a one-off's date lives in its single instance, and
 * PATCH carries no due_date, so the task would end up with no dates, no instances, and no way to
 * acquire either — invisible to every worker, since workers only ever see instances.
 *
 * One-off -> recurring is refused for the mirror-image reason: the authored instance is not
 * something a rule produced, so the reconcile would either delete work the creator entered by hand
 * or leave a date the new rule does not explain. Neither is a conversion anyone asked for.
 *
 * Restating the current value is not a change and is allowed through.
 */
export class InvalidScheduleChangeError extends Error {
    constructor(
        message = "A task's is_recurring cannot be changed after creation: one-off and recurring tasks carry their dates differently. Create a new task instead.",
    ) {
        super(message)
        this.name = 'InvalidScheduleChangeError'
    }
}
