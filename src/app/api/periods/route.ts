import { NextRequest, NextResponse } from 'next/server'
import { PeriodService } from '@/services/period-service'
import { CreatePeriodSchema, PeriodFiltersSchema } from '@/types/shift-period'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'

/**
 * GET /api/periods?branchId=
 *
 * Periods available to a branch: its own plus every chain-wide one, ordered the way a picker
 * should list them (sort_order, then name).
 */
export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams

    const validationResult = PeriodFiltersSchema.safeParse({
        branchId: searchParams.get('branchId') ?? undefined,
    })

    if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
    }

    try {
        const periods = await PeriodService.getPeriodsByBranch(validationResult.data.branchId)
        return NextResponse.json(periods, { status: 200 })
    } catch (error) {
        if (error instanceof BranchNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch periods' }, { status: 500 })
    }
}

/** POST /api/periods — branchId is optional; null or omitted means a chain-wide period. */
export async function POST(req: NextRequest) {
    let body
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const validationResult = CreatePeriodSchema.safeParse(body);

    if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
    }

    try {
        const period = await PeriodService.createPeriod(validationResult.data);
        return NextResponse.json(period, { status: 201 })
    } catch (error) {
        if (error instanceof BranchNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to create period' }, { status: 500 })
    }
}
