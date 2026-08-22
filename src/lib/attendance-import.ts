import * as XLSX from 'xlsx';
import { machineTimeToUtc } from '@/lib/machine-time';

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** The machine exports at most five in/out pairs per employee per day. */
const MAX_PAIRS = 5;

const ALLOWED_IMPORT_EXTENSIONS = ['.csv', '.xls', '.xlsx'];

const ALLOWED_IMPORT_MIME_TYPES = new Set([
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

/** The file itself is unusable — as opposed to a row inside it, which is reported per row. */
export class InvalidImportFileError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidImportFileError';
    }
}

/**
 * Rejects anything that is not a CSV or Excel export by name or declared type, before it is
 * handed to the spreadsheet parser.
 */
export function assertImportableFile(file: File): void {
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();

    if (ALLOWED_IMPORT_EXTENSIONS.includes(extension) || ALLOWED_IMPORT_MIME_TYPES.has(file.type)) {
        return;
    }

    throw new InvalidImportFileError(
        `Unsupported file '${file.name}'. Expected a CSV or Excel export (.csv, .xls, .xlsx)`,
    );
}

export interface ParsedPunch {
    /** 1-based row in the sheet, so an error can name the line the manager sees in Excel */
    row: number;
    machineEmployeeId: string;
    name: string;
    clockIn: Date;
    clockOut: Date | null;
}

export interface ImportRowError {
    row: number;
    message: string;
}

export interface ParsedSheet {
    punches: ParsedPunch[];
    errors: ImportRowError[];
}

interface ColumnMap {
    machineEmployeeId: number;
    name: number;
    date: number;
    pairs: { clockIn: number; clockOut: number }[];
}

/**
 * Reads the clock machine's export into punches. Columns are located by header text, not
 * position, since the export carries blank spacer columns and a 'Total in time' duration column.
 * A row that fails to parse becomes an `errors` entry rather than stopping the whole file.
 */
export function parseAttendanceWorkbook(buffer: Buffer): ParsedSheet {
    let workbook: XLSX.WorkBook;
    try {
        workbook = XLSX.read(buffer, { type: 'buffer' });
    } catch {
        throw new InvalidImportFileError('The file could not be read as a spreadsheet');
    }

    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
        throw new InvalidImportFileError('The file contains no sheets');
    }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
        header: 1,
        // formatted text, so a cell reads as the manager sees it in Excel rather than as a serial
        raw: false,
        defval: '',
        blankrows: false,
    });

    const headerIndex = rows.findIndex(isHeaderRow);

    if (headerIndex === -1) {
        throw new InvalidImportFileError(
            "Could not find the header row. Expected columns 'Emp No.', 'Date' and 'Clock In 1'",
        );
    }

    const columns = mapColumns(rows[headerIndex]);
    const punches: ParsedPunch[] = [];
    const errors: ImportRowError[] = [];

    rows.slice(headerIndex + 1).forEach((row, offset) => {
        // +1 for the header itself, +1 again because spreadsheet rows are 1-based
        readRow(row, columns, headerIndex + offset + 2, punches, errors);
    });

    return { punches, errors };
}

function isHeaderRow(row: unknown[]): boolean {
    return row.some((cell) => /^\s*emp\s*no/i.test(text(cell)))
        && row.some((cell) => /^\s*clock\s*in\s*1/i.test(text(cell)));
}

function mapColumns(header: unknown[]): ColumnMap {
    const find = (pattern: RegExp) => header.findIndex((cell) => pattern.test(text(cell)));

    const pairs: ColumnMap['pairs'] = [];

    for (let pair = 1; pair <= MAX_PAIRS; pair += 1) {
        const clockIn = find(new RegExp(`^\\s*clock\\s*in\\s*${pair}\\s*$`, 'i'));
        const clockOut = find(new RegExp(`^\\s*clock\\s*out\\s*${pair}\\s*$`, 'i'));

        if (clockIn !== -1) {
            pairs.push({ clockIn, clockOut });
        }
    }

    const date = find(/^\s*date\s*$/i);

    if (date === -1) {
        throw new InvalidImportFileError("Could not find a 'Date' column");
    }

    return {
        machineEmployeeId: find(/^\s*emp\s*no/i),
        name: find(/^\s*name\s*$/i),
        date,
        pairs,
    };
}

function readRow(
    row: unknown[],
    columns: ColumnMap,
    rowNumber: number,
    punches: ParsedPunch[],
    errors: ImportRowError[],
): void {
    const machineEmployeeId = text(row[columns.machineEmployeeId]);
    const dateText = text(row[columns.date]);

    // trailing blank lines and the export's summary rows carry no employee or no date
    if (!machineEmployeeId && !dateText) {
        return;
    }

    if (!machineEmployeeId) {
        errors.push({ row: rowNumber, message: 'Missing employee number' });
        return;
    }

    const date = parseDate(dateText);

    if (!date) {
        errors.push({ row: rowNumber, message: `Unreadable date '${dateText}'` });
        return;
    }

    const name = columns.name === -1 ? '' : text(row[columns.name]);

    for (const [index, pair] of columns.pairs.entries()) {
        const inText = text(row[pair.clockIn]);
        const outText = pair.clockOut === -1 ? '' : text(row[pair.clockOut]);

        if (!inText && !outText) {
            continue;
        }

        if (!inText) {
            errors.push({
                row: rowNumber,
                message: `Clock Out ${index + 1} has no matching clock-in`,
            });
            continue;
        }

        const clockIn = parseTime(inText);
        const clockOut = outText ? parseTime(outText) : null;

        if (!clockIn || (outText && !clockOut)) {
            errors.push({
                row: rowNumber,
                message: `Unreadable time in pair ${index + 1}: '${inText}'${outText ? ` / '${outText}'` : ''}`,
            });
            continue;
        }

        punches.push({
            row: rowNumber,
            machineEmployeeId,
            name,
            clockIn: toInstant(date, clockIn),
            clockOut: clockOut ? closingInstant(date, clockIn, clockOut) : null,
        });
    }
}

interface CalendarDate {
    year: number;
    month: number;
    day: number;
}

interface WallClock {
    hours: number;
    minutes: number;
    seconds: number;
}

function toInstant(date: CalendarDate, time: WallClock): Date {
    return machineTimeToUtc(date.year, date.month, date.day, time.hours, time.minutes, time.seconds);
}

/**
 * A clock-out at or before its clock-in belongs to the next morning: the machine stamps the whole
 * pair on the day the shift started, so a 3:00 PM to 1:00 AM night shift reads as going backwards.
 */
function closingInstant(date: CalendarDate, clockIn: WallClock, clockOut: WallClock): Date {
    const closing = toInstant(date, clockOut);
    const opening = toInstant(date, clockIn);

    if (closing > opening) {
        return closing;
    }

    return machineTimeToUtc(
        date.year,
        date.month,
        date.day + 1,
        clockOut.hours,
        clockOut.minutes,
        clockOut.seconds,
    );
}

/** 'M/D/YYYY' as the machine writes it, plus 'YYYY-MM-DD' for a hand-edited file. */
function parseDate(value: string): CalendarDate | null {
    const slashed = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(value);

    if (slashed) {
        const [, month, day, year] = slashed;
        return validDate({
            year: year.length === 2 ? 2000 + Number(year) : Number(year),
            month: Number(month),
            day: Number(day),
        });
    }

    const dashed = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);

    if (dashed) {
        const [, year, month, day] = dashed;
        return validDate({ year: Number(year), month: Number(month), day: Number(day) });
    }

    return null;
}

/** Rejects days that fit the shape but not the calendar, e.g. 2/31. */
function validDate(date: CalendarDate): CalendarDate | null {
    const probe = new Date(Date.UTC(date.year, date.month - 1, date.day));

    const isReal = probe.getUTCFullYear() === date.year
        && probe.getUTCMonth() === date.month - 1
        && probe.getUTCDate() === date.day;

    return isReal ? date : null;
}

/** '3:00:00 PM' and '3:00 PM' as the machine writes them, plus 24-hour '15:00[:00]'. */
function parseTime(value: string): WallClock | null {
    const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp])?\.?[Mm]?\.?$/.exec(value.trim());

    if (!match) {
        return null;
    }

    const [, rawHours, rawMinutes, rawSeconds, meridiem] = match;

    let hours = Number(rawHours);
    const minutes = Number(rawMinutes);
    const seconds = rawSeconds ? Number(rawSeconds) : 0;

    if (meridiem) {
        if (hours < 1 || hours > 12) {
            return null;
        }
        const isPm = meridiem.toLowerCase() === 'p';
        hours = isPm ? (hours % 12) + 12 : hours % 12;
    }

    if (hours > 23 || minutes > 59 || seconds > 59) {
        return null;
    }

    return { hours, minutes, seconds };
}

/** Cells arrive as strings, but a date-formatted cell can still come through as a Date. */
function text(cell: unknown): string {
    if (cell instanceof Date) {
        return `${cell.getUTCMonth() + 1}/${cell.getUTCDate()}/${cell.getUTCFullYear()}`;
    }

    return typeof cell === 'string' ? cell.trim() : String(cell ?? '').trim();
}
