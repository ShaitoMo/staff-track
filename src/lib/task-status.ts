import { TaskStatus } from '@/types/task-instance';
import { InvalidStatusTransitionError } from '@/exceptions/invalid-status-transition-error';

/**
 * The only legal status moves — every write checks this map, so 'what may follow what' is
 * stated once. pending -> completed -> verified|rejected; verified/rejected are terminal.
 */
export const STATUS_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
    pending: ['completed'],
    completed: ['verified', 'rejected'],
    verified: [],
    rejected: [],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
    return STATUS_TRANSITIONS[from].includes(to);
}

/** Throws InvalidStatusTransitionError (-> 409) when the move is not in the map. */
export function assertTransition(from: TaskStatus, to: TaskStatus): void {
    if (!canTransition(from, to)) {
        throw new InvalidStatusTransitionError(from, to);
    }
}
