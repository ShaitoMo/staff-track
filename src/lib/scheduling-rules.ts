import type { ProposalEmployee, ProposedShift, ScheduleRestriction, ScheduleRules, ShiftCell } from "@/types/schedule-builder";

/** The part of a shift the rules look at. */
interface BookedShift {
    user_id: number;
    shift_date: string;
    period_id: number | null;
}

type Pair = ScheduleRules["keepApart"][number];

/** Each person's keep-apart partners, both directions. */
function partnerMap(keepApart: Pair[]): Map<number, number[]> {
    const partners = new Map<number, number[]>();
    for (const [a, b] of keepApart) {
        partners.set(a, [...(partners.get(a) ?? []), b]);
        partners.set(b, [...(partners.get(b) ?? []), a]);
    }
    return partners;
}

/** Everyone paired with any of `userIds`, including partners who aren't up for this week themselves. */
export function partnersOf(keepApart: Pair[], userIds: number[]): number[] {
    const partners = partnerMap(keepApart);
    return [...new Set(userIds.flatMap((userId) => partners.get(userId) ?? []))].toSorted((a, b) => a - b);
}

/**
 * Each person's rules for the week. `branchShifts` are the shifts already booked at this branch:
 * where a partner already works, this person can't. Shifts with no period hold no (day, period),
 * so they block nothing.
 */
export function resolveRestrictions(
    userIds: number[],
    rules: ScheduleRules,
    branchShifts: BookedShift[],
): Map<number, ScheduleRestriction> {
    const partners = partnerMap(rules.keepApart);
    const limits = new Map(
        rules.periodLimits
            .filter((limit) => limit.periodIds.length > 0)
            .map((limit) => [limit.userId, limit.periodIds]),
    );

    return new Map(
        userIds.map((userId) => {
            const keepApartWith = partners.get(userId) ?? [];
            const partnerShifts = branchShifts
                .filter((shift) => shift.period_id !== null && keepApartWith.includes(shift.user_id))
                .map((shift) => ({ shiftDate: shift.shift_date, periodId: shift.period_id as number }));

            return [userId, { allowedPeriodIds: limits.get(userId) ?? null, keepApartWith, partnerShifts }];
        }),
    );
}

/** Whether the rules let this person work `cell`, before looking at anyone else in the proposal. */
export function isAllowedIn(restriction: ScheduleRestriction, cell: ShiftCell): boolean {
    if (restriction.allowedPeriodIds !== null && !restriction.allowedPeriodIds.includes(cell.periodId)) {
        return false;
    }

    return !restriction.partnerShifts.some(
        (shift) => shift.shiftDate === cell.shiftDate && shift.periodId === cell.periodId,
    );
}

/** The slots the solver must not give this person, in id order: a day they're already booked, or a cell their rules rule out. */
export function blockedSlotIds(
    person: ScheduleRestriction & Pick<ProposalEmployee, "busyDates">,
    slots: { slotId: number; date: string; periodId: number }[],
): number[] {
    return slots
        .filter((slot) => person.busyDates.includes(slot.date) || !isAllowedIn(person, { shiftDate: slot.date, periodId: slot.periodId }))
        .map((slot) => slot.slotId);
}

/** What stops someone taking a cell: already working that day, a scheduling rule, or the weekly cap. */
export type BlockReason = "busy" | "rule" | "cap";

/**
 * Whether `person` could take `cell` alongside `others` (the rest of the shifts being placed), under
 * the solver's own rules: one shift a day counting what they're already booked for anywhere, their
 * period limit, no keep-apart partner in the same day and period (already booked here, or among
 * `others`), and the weekly cap. The role isn't checked here. Shared by the swap picker, the
 * short-slot reasons and approve, so all three judge a row the same way.
 */
export function blockReason(
    person: ProposalEmployee,
    cell: ShiftCell,
    others: ProposedShift[],
    maxShiftsPerWeek: number,
): BlockReason | null {
    const theirs = others.filter((other) => other.userId === person.userId);
    if (person.busyDates.includes(cell.shiftDate) || theirs.some((other) => other.shiftDate === cell.shiftDate)) {
        return "busy";
    }

    const partnerThere = others.some((other) =>
        other.shiftDate === cell.shiftDate && other.periodId === cell.periodId && person.keepApartWith.includes(other.userId));
    if (partnerThere || !isAllowedIn(person, cell)) {
        return "rule";
    }

    return person.existingShifts + theirs.length >= maxShiftsPerWeek ? "cap" : null;
}
