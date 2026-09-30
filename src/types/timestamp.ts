import { z } from 'zod';

/**
 * An ISO 8601 instant with timezone offset. Requires explicit timezone to avoid ambiguity
 * and silent time shifts between server and branch locations.
 */
export const TimestampSchema = z.iso
    .datetime({ offset: true })
    .transform((value) => new Date(value));
