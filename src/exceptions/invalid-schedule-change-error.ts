/**
 * An attempt to change a task's kind (-> 400). `is_recurring` is fixed at creation: recurring ->
 * one-off would leave the task with no due_date and no instances; one-off -> recurring would
 * delete the hand-authored instance or leave a date the new rule doesn't explain. Restating the
 * current value is not a change and is allowed.
 */
export class InvalidScheduleChangeError extends Error {
    constructor(
        message = "A task's is_recurring cannot be changed after creation: one-off and recurring tasks carry their dates differently. Create a new task instead.",
    ) {
        super(message)
        this.name = 'InvalidScheduleChangeError'
    }
}
