import { NextResponse } from 'next/server';
import { AttendanceService } from '@/services/attendance-service';

/** GET /api/import-batches — every clock-machine upload, newest first. */
export async function GET() {
    try {
        const batches = await AttendanceService.getImportBatches();
        return NextResponse.json(batches, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch import batches' }, { status: 500 });
    }
}
