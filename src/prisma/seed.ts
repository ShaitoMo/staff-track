/**
 * Demo seed: a three-branch Lebanese supermarket chain, filled from the 1st of this month through the
 * 15th of next month (Beirut dates) and empty after that. Wipes the database first, so it is re-runnable. Every user logs
 * in with DEMO_PASSWORD; the accounts are listed in docs/demo-accounts.md.
 *
 * Random choices come from a fixed-seed generator, so two runs on the same day produce the same data.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { AttendanceSource, PrismaClient, TaskOrigin, TaskStatus } from "@prisma/client";
import bcrypt from "bcrypt";
import jpeg from "jpeg-js";
import { machineDayOf, machineTimeToUtc } from "@/lib/machine-time";
import { addDays, getDates } from "@/lib/recurrence";
import { putPhoto } from "@/lib/storage";
import { logger } from "@/lib/logger";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const DEMO_PASSWORD = "123456";
const PHOTO_PREFIX = "task-instances/demo/";

// ---------- Small helpers ----------

/** mulberry32: a tiny deterministic PRNG, so the demo looks the same on every run. */
function generator(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = generator(20261011);
const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];

// time-only values only care about HH:MM; the date part is ignored by @db.Time
const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`);
const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

const now = new Date();
const today = machineDayOf(now); // today in Beirut, as UTC midnight like a `date` column
const day = (offset: number) => addDays(today, offset);
const offsetOf = (date: Date) => Math.round((date.getTime() - today.getTime()) / 86_400_000);

// The demo's span: the 1st of this month through the 15th of next month. Past days get attendance
// and task results; days after today get shifts and pending tasks; nothing exists past the end.
const rangeStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
const rangeEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 15));
const FIRST_OFFSET = offsetOf(rangeStart);
const LAST_OFFSET = offsetOf(rangeEnd);
const weekday = (date: Date) => date.getUTCDay(); // 0 = Sunday

/** A Beirut wall-clock moment on `date`, `minutes` after midnight, as the instant it happened. */
function at(date: Date, minutes: number): Date {
  return machineTimeToUtc(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), Math.floor(minutes / 60), minutes % 60);
}

const mondayOf = (date: Date) => addDays(date, -((weekday(date) + 6) % 7));
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

// ---------- Demo photos ----------

/**
 * A 640x480 JPEG that reads as a store shelf: a gradient wall, four shelf boards and rows of
 * product blocks in the photo's palette. Placeholder proof, but a real image every link can open.
 */
function shelfPhoto(hue: number, seed: number): Uint8Array {
  const width = 640, height = 480;
  const rand = generator(seed);
  const data = Buffer.alloc(width * height * 4);
  const rgb = (h: number, s: number, l: number) => {
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    return [f(0), f(8), f(4)];
  };
  const fill = (x0: number, y0: number, x1: number, y1: number, [r, g, b]: number[]) => {
    for (let y = Math.max(0, y0); y < Math.min(height, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(width, x1); x++) {
        const i = (y * width + x) * 4;
        data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
      }
    }
  };

  for (let y = 0; y < height; y++) fill(0, y, width, y + 1, rgb(hue, 0.25, 0.82 - (y / height) * 0.25));

  for (let shelf = 0; shelf < 4; shelf++) {
    const base = 110 + shelf * 105;
    let x = 12;
    while (x < width - 30) {
      const w = 22 + Math.floor(rand() * 40);
      const h = 45 + Math.floor(rand() * 45);
      fill(x, base - h, x + w, base, rgb((hue + rand() * 70 - 35 + 360) % 360, 0.55, 0.35 + rand() * 0.3));
      fill(x + 4, base - h + 10, x + w - 4, base - h + 18, [245, 245, 240]); // label
      x += w + 4 + Math.floor(rand() * 6);
    }
    fill(0, base, width, base + 10, [92, 84, 76]); // shelf board
  }

  return jpeg.encode({ data, width, height }, 72).data;
}

/** One photo per kind of task, shared by every completion of that kind. */
const PHOTO_HUES: Record<string, number> = {
  opening: 210, fridge: 195, dairy: 50, register: 140, butcher: 0, floor: 30,
  bakery: 35, freezer: 220, report: 260, display: 320, shelf: 90, general: 170,
};
const photoKey = (kind: string) => `${PHOTO_PREFIX}${kind}.jpg`;

async function uploadDemoPhotos() {
  if (!process.env.R2_BUCKET) {
    logger.warn("R2 env vars not set: demo photo links will not load");
    return;
  }
  await Promise.all(
    Object.entries(PHOTO_HUES).map(([kind, hue], i) => putPhoto(photoKey(kind), shelfPhoto(hue, i + 1))),
  );
}

// ---------- The chain ----------

type RoleName = "owner" | "manager" | "cashier" | "stocker" | "butcher" | "cleaner";
type BranchKey = "hamra" | "achrafieh" | "jounieh";
type PeriodName = "Morning" | "Evening";

interface Person {
  name: string;
  phone: string;
  role: RoleName;
  branches: BranchKey[]; // first one is home: its manager schedules them
  period?: PeriodName; // fixed slot; omitted = alternates weekly
  inactive?: boolean;
}

const BRANCHES: Record<BranchKey, { name: string; location: string; registers: number }> = {
  hamra: { name: "Hamra", location: "Hamra Street, Beirut", registers: 4 },
  achrafieh: { name: "Achrafieh", location: "Sassine Square, Achrafieh", registers: 3 },
  jounieh: { name: "Jounieh", location: "Fouad Chehab Highway, Jounieh", registers: 2 },
};

const PEOPLE: Person[] = [
  { name: "Karim Haddad", phone: "70000000", role: "owner", branches: [] },

  { name: "Rania Khoury", phone: "70000001", role: "manager", branches: ["hamra"], period: "Morning" },
  { name: "Tarek Mansour", phone: "70000004", role: "manager", branches: ["hamra"], period: "Evening" },
  { name: "Lara Fakhoury", phone: "71100101", role: "cashier", branches: ["hamra"] },
  { name: "Omar Itani", phone: "71100102", role: "cashier", branches: ["hamra"] },
  { name: "Nour El Hajj", phone: "71100103", role: "cashier", branches: ["hamra"] },
  { name: "Joelle Abi Nader", phone: "71100104", role: "cashier", branches: ["hamra"] },
  { name: "Ziad Sleiman", phone: "71100105", role: "cashier", branches: ["hamra", "achrafieh"], period: "Morning" },
  { name: "Ali Hammoud", phone: "71100106", role: "stocker", branches: ["hamra"], period: "Morning" },
  { name: "Elie Rizk", phone: "71100107", role: "stocker", branches: ["hamra"], period: "Morning" },
  { name: "Samir Kanaan", phone: "71100108", role: "stocker", branches: ["hamra"], period: "Evening" },
  { name: "Bilal Sabbagh", phone: "71100109", role: "butcher", branches: ["hamra"], period: "Morning" },
  { name: "Mariam Kassem", phone: "71100110", role: "cleaner", branches: ["hamra"], period: "Morning" },

  { name: "Georges Saliba", phone: "70000002", role: "manager", branches: ["achrafieh"], period: "Morning" },
  { name: "Christelle Tannous", phone: "71200101", role: "cashier", branches: ["achrafieh"] },
  { name: "Rami Jaber", phone: "71200102", role: "cashier", branches: ["achrafieh"] },
  { name: "Yara Daher", phone: "71200103", role: "cashier", branches: ["achrafieh"] },
  { name: "Michel Azar", phone: "71200104", role: "stocker", branches: ["achrafieh"], period: "Morning" },
  { name: "Jad Moussa", phone: "71200105", role: "stocker", branches: ["achrafieh"], period: "Evening" },
  { name: "Antoine Karam", phone: "71200106", role: "butcher", branches: ["achrafieh"], period: "Morning" },
  { name: "Hiba Zein", phone: "71200107", role: "cleaner", branches: ["achrafieh"], period: "Morning" },

  { name: "Maya Nassar", phone: "70000003", role: "manager", branches: ["jounieh"], period: "Morning" },
  { name: "Carla Nehme", phone: "71300101", role: "cashier", branches: ["jounieh"] },
  { name: "Charbel Feghali", phone: "71300102", role: "cashier", branches: ["jounieh"] },
  { name: "Rita Sfeir", phone: "71300103", role: "cashier", branches: ["jounieh"] },
  { name: "Joseph Hanna", phone: "71300104", role: "stocker", branches: ["jounieh"], period: "Morning" },
  { name: "Elias Bou Khalil", phone: "71300105", role: "stocker", branches: ["jounieh"], period: "Evening", inactive: true },
  { name: "Nabil Khalil", phone: "71300106", role: "butcher", branches: ["jounieh"], period: "Morning" },
  { name: "Sana Ayoub", phone: "71300107", role: "cleaner", branches: ["jounieh"], period: "Morning" },
];

/** How many of each role a branch wants per period — set a little above who's on, so gaps show. */
const COVERAGE: Record<BranchKey, Partial<Record<RoleName, [number, number]>>> = {
  hamra: { manager: [1, 1], cashier: [3, 2], stocker: [2, 1], butcher: [1, 0], cleaner: [1, 1] },
  achrafieh: { manager: [1, 1], cashier: [2, 2], stocker: [1, 1], butcher: [1, 0], cleaner: [1, 0] },
  jounieh: { manager: [1, 0], cashier: [2, 1], stocker: [1, 1], butcher: [1, 0], cleaner: [1, 0] },
};

interface TaskTemplate {
  title: string;
  description: string;
  photo: keyof typeof PHOTO_HUES;
  role?: RoleName; // a whole role at the branch...
  person?: string; // ...or one named person (exactly one of the two)
  recurrence?: string; // omitted = one-off on `due`
  due?: number; // day offset for a one-off
  self?: boolean; // reported by the worker themself
  inactive?: boolean;
  window: [number, number]; // Beirut minutes the work gets done in
}

const MORNING_WORK: [number, number] = [7 * 60 + 20, 14 * 60];
const EVENING_WORK: [number, number] = [16 * 60, 22 * 60 + 30];

const ROUTINES: TaskTemplate[] = [
  { title: "Morning opening checklist", description: "Lights, alarm, cash floats and fresh produce out before the doors open at 7:30.", photo: "opening", role: "manager", recurrence: "daily", window: [6 * 60 + 50, 7 * 60 + 30] },
  { title: "Check fridge and freezer temperatures", description: "Log every fridge and freezer reading. Anything above 5°C goes straight to the manager.", photo: "fridge", role: "stocker", recurrence: "daily", window: MORNING_WORK },
  { title: "Restock dairy and bread aisles", description: "Front-face labneh, milk and bread; pull anything expiring tomorrow.", photo: "dairy", role: "stocker", recurrence: "daily", window: MORNING_WORK },
  { title: "Count and hand over register floats", description: "Count each drawer at shift change, in LBP and USD, and sign the handover sheet.", photo: "register", role: "cashier", recurrence: "daily", window: [14 * 60 + 40, 15 * 60 + 20] },
  { title: "Clean and sanitize the butcher counter", description: "Strip, wash and sanitize boards, knives and the display case at closing.", photo: "butcher", role: "butcher", recurrence: "daily", window: [13 * 60, 14 * 60 + 45] },
  { title: "Mop entrance and checkout area", description: "Twice a day, more when it rains.", photo: "floor", role: "cleaner", recurrence: "daily", window: MORNING_WORK },
  { title: "Rotate bakery stock (first in, first out)", description: "Move older stock to the front and log anything for markdown.", photo: "bakery", role: "stocker", recurrence: "weekly:mon,thu", window: MORNING_WORK },
  { title: "Deep clean the walk-in freezer", description: "Empty, defrost the shelves, wipe down and restock by section.", photo: "freezer", role: "cleaner", recurrence: "weekly:sat", window: MORNING_WORK },
];

const BRANCH_TASKS: Record<BranchKey, TaskTemplate[]> = {
  hamra: [
    { title: "Weekly waste and expiry report", description: "Total the week's markdowns and write-offs by department.", photo: "report", person: "Rania Khoury", recurrence: "weekly:sun", window: [11 * 60, 13 * 60] },
    { title: "Build the summer drinks display at the entrance", description: "Use the new cooler stand; juices on top, water at the bottom.", photo: "display", person: "Ali Hammoud", due: 2, window: MORNING_WORK },
    { title: "Price-check the olive oil shelf", description: "The supplier raised prices on Monday; every tag must match the system.", photo: "shelf", person: "Lara Fakhoury", due: -3, window: MORNING_WORK },
    { title: "Report the flickering light in aisle 6", description: "Call maintenance and photo the ticket number.", photo: "general", person: "Tarek Mansour", due: -1, window: EVENING_WORK },
    { title: "Helped a customer carry water gallons to their car", description: "Reported by the cashier.", photo: "general", person: "Omar Itani", due: -2, self: true, window: MORNING_WORK },
  ],
  achrafieh: [
    { title: "Weekly waste and expiry report", description: "Total the week's markdowns and write-offs by department.", photo: "report", person: "Georges Saliba", recurrence: "weekly:sun", window: [11 * 60, 13 * 60] },
    { title: "Set up the back-to-school stationery stand", description: "Next to checkout 1; notebooks and pens on the eye-level shelf.", photo: "display", person: "Michel Azar", due: -5, window: MORNING_WORK },
    { title: "Show the new cashier the card terminal", description: "Refunds, split payments and the end-of-day report.", photo: "register", person: "Christelle Tannous", due: 1, window: MORNING_WORK },
    { title: "Cleaned up a broken jar in aisle 3", description: "Reported by the cashier.", photo: "floor", person: "Rami Jaber", due: -1, self: true, window: MORNING_WORK },
  ],
  jounieh: [
    { title: "Weekly waste and expiry report", description: "Total the week's markdowns and write-offs by department.", photo: "report", person: "Maya Nassar", recurrence: "weekly:sun", window: [11 * 60, 13 * 60] },
    { title: "Inventory count: cleaning products aisle", description: "Count every facing and the back stock; enter totals in the sheet.", photo: "shelf", person: "Joseph Hanna", due: -2, window: MORNING_WORK },
    { title: "Replace price tags after the promo ends", description: "Swap all yellow promo tags back to regular prices.", photo: "shelf", person: "Carla Nehme", due: 0, window: MORNING_WORK },
    { title: "Defrost the ice-cream freezer (old routine)", description: "Replaced by the new self-defrosting unit.", photo: "freezer", role: "stocker", recurrence: "weekly:wed", inactive: true, window: MORNING_WORK },
  ],
};

// ---------- Seed ----------

async function wipe() {
  // FK-safe (child -> parent) order
  await prisma.media.deleteMany();
  await prisma.taskInstance.deleteMany();
  await prisma.task.deleteMany();
  await prisma.guideImage.deleteMany();
  await prisma.guideFolder.deleteMany();
  await prisma.branchSection.deleteMany();
  await prisma.sectionType.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.coverageRequirement.deleteMany();
  await prisma.shiftPeriod.deleteMany();
  await prisma.register.deleteMany();
  await prisma.userBranch.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.role.deleteMany();
}

/** The seed deletes everything first, so a non-local database needs SEED_ALLOW_REMOTE=1. */
function assertSafeTarget() {
  const host = connectionString ? new URL(connectionString).hostname : "";
  if (host === "localhost" || host === "127.0.0.1" || process.env.SEED_ALLOW_REMOTE === "1") return;
  throw new Error(`Refusing to wipe the database at "${host}": set SEED_ALLOW_REMOTE=1 to seed a non-local database`);
}

async function main() {
  assertSafeTarget();
  await wipe();
  await uploadDemoPhotos();

  // ---------- Roles, branches, registers ----------
  // "owner" and "manager" are checked by name in src/lib/rbac.ts
  const roleNames: RoleName[] = ["owner", "manager", "cashier", "stocker", "butcher", "cleaner"];
  const roles = await prisma.role.createManyAndReturn({ data: roleNames.map((name) => ({ name })) });
  const roleId = (name: RoleName) => roles.find((role) => role.name === name)!.roleId;

  const branchId = {} as Record<BranchKey, number>;
  const registerIds = {} as Record<BranchKey, number[]>;
  for (const [key, branch] of Object.entries(BRANCHES) as [BranchKey, (typeof BRANCHES)[BranchKey]][]) {
    const created = await prisma.branch.create({ data: { name: branch.name, location: branch.location } });
    branchId[key] = created.branchId;
    const registers = await prisma.register.createManyAndReturn({
      data: Array.from({ length: branch.registers }, (_, i) => ({ branchId: created.branchId, name: `Register ${i + 1}` })),
    });
    registerIds[key] = registers.map((register) => register.registerId);
  }

  // ---------- Users and branch links ----------
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = await prisma.user.createManyAndReturn({
    data: PEOPLE.map((person, i) => ({
      name: person.name,
      phone: person.phone,
      passwordHash,
      roleId: roleId(person.role),
      isActive: !person.inactive,
      createdAt: day(-400 + i * 9),
    })),
  });
  const userId = (name: string) => users.find((user) => user.name === name)!.userId;
  const staff = PEOPLE.map((person) => ({ ...person, userId: userId(person.name) }));
  type Staff = (typeof staff)[number];

  const nextMachineId: Record<BranchKey, number> = { hamra: 101, achrafieh: 101, jounieh: 101 };
  await prisma.userBranch.createMany({
    data: staff.flatMap((person) =>
      person.branches.map((branch) => ({
        userId: person.userId,
        branchId: branchId[branch],
        machineEmployeeId: String(nextMachineId[branch]++),
      })),
    ),
  });

  const managerOf = (branch: BranchKey) => staff.find((p) => p.role === "manager" && p.branches[0] === branch)!;
  const owner = staff.find((p) => p.role === "owner")!;

  // ---------- Periods and coverage ----------
  const chainMorning = await prisma.shiftPeriod.create({ data: { name: "Morning", defaultStart: time("07:00"), defaultEnd: time("15:00"), sortOrder: 1 } });
  const chainEvening = await prisma.shiftPeriod.create({ data: { name: "Evening", defaultStart: time("15:00"), defaultEnd: time("23:00"), sortOrder: 2 } });
  // Jounieh opens an hour later, so it has its own version of the morning slot
  const jouniehMorning = await prisma.shiftPeriod.create({ data: { branchId: branchId.jounieh, name: "Morning", defaultStart: time("08:00"), defaultEnd: time("16:00"), sortOrder: 1 } });
  // retired last week: old shifts keep it, new ones can't pick it
  const midDay = await prisma.shiftPeriod.create({ data: { name: "Mid-day", defaultStart: time("11:00"), defaultEnd: time("19:00"), sortOrder: 3, active: false } });

  const hours = {
    Morning: (branch: BranchKey) => (branch === "jounieh" ? { period: jouniehMorning, start: "08:00", end: "16:00" } : { period: chainMorning, start: "07:00", end: "15:00" }),
    Evening: () => ({ period: chainEvening, start: "15:00", end: "23:00" }),
  };

  await prisma.coverageRequirement.createMany({
    data: (Object.keys(COVERAGE) as BranchKey[]).flatMap((branch) =>
      Object.entries(COVERAGE[branch]).flatMap(([role, [morning, evening]]) => [
        { branchId: branchId[branch], roleId: roleId(role as RoleName), periodId: hours.Morning(branch).period.periodId, requiredCount: morning },
        { branchId: branchId[branch], roleId: roleId(role as RoleName), periodId: chainEvening.periodId, requiredCount: evening },
      ]),
    ),
  });

  // ---------- Shifts ----------
  interface PlannedShift {
    person: Staff;
    branch: BranchKey;
    date: Date;
    offset: number;
    periodId: number | null;
    start: string;
    end: string;
    registerId: number | null;
  }
  const planned: PlannedShift[] = [];

  for (let offset = FIRST_OFFSET; offset <= LAST_OFFSET; offset++) {
    const date = day(offset);
    const week = Math.floor((offset - FIRST_OFFSET) / 7);
    const registerQueue = new Map<string, number[]>();

    staff.forEach((person, index) => {
      if (person.role === "owner") return;
      if (person.inactive && offset > -8) return; // left the company a week ago
      if (weekday(date) === (index * 3) % 7) return; // one fixed day off a week

      // the floater covers Hamra early in the week and Achrafieh later
      const branch = person.branches.length > 1 && weekday(date) >= 4 ? person.branches[1] : person.branches[0];
      const period: PeriodName = person.period ?? ((week + index) % 2 === 0 ? "Morning" : "Evening");

      let slot: { periodId: number | null; start: string; end: string };
      if (person.name === "Samir Kanaan" && offset < -7) {
        slot = { periodId: midDay.periodId, start: "11:00", end: "19:00" }; // before Mid-day was retired
      } else if (person.name === "Nabil Khalil" && weekday(date) === 6) {
        slot = { periodId: null, start: "07:00", end: "13:00" }; // the butcher's short Saturday: custom hours
      } else {
        const chosen = period === "Morning" ? hours.Morning(branch) : hours.Evening();
        slot = { periodId: chosen.period.periodId, start: chosen.start, end: chosen.end };
      }

      let registerId: number | null = null;
      if (person.role === "cashier") {
        const queueKey = `${branch}:${slot.start}`;
        if (!registerQueue.has(queueKey)) registerQueue.set(queueKey, [...registerIds[branch]]);
        registerId = registerQueue.get(queueKey)!.shift() ?? null;
      }

      planned.push({ person, branch, date, offset, ...slot, registerId });
    });
  }

  await prisma.shift.createMany({
    data: planned.map((shift) => ({
      userId: shift.person.userId,
      branchId: branchId[shift.branch],
      registerId: shift.registerId,
      periodId: shift.periodId,
      shiftDate: shift.date,
      startTime: time(shift.start),
      endTime: time(shift.end),
      createdBy: managerOf(shift.branch).userId,
      createdAt: shift.offset > 0 ? today : addDays(shift.date, -6),
    })),
  });

  // ---------- Attendance ----------
  // Weeks before this one came in as one machine export per branch; this week's punches are
  // still arriving from the machine. A couple of forgotten clock-ins were fixed by hand.
  const thisMonday = mondayOf(today);
  const batches = new Map<string, number>();
  const batchFor = async (branch: BranchKey, date: Date) => {
    const monday = isoDay(mondayOf(date));
    const key = `${branch}:${monday}`;
    if (!batches.has(key)) {
      const batch = await prisma.importBatch.create({
        data: {
          fileName: `${branch}-attendance-week-${monday}.csv`,
          importedBy: managerOf(branch).userId,
          importedAt: at(addDays(mondayOf(date), 7), 9 * 60 + 15),
        },
      });
      batches.set(key, batch.batchId);
    }
    return batches.get(key)!;
  };

  const punches = [];
  for (const shift of planned) {
    if (shift.offset > 0) continue;
    const start = minutesOf(shift.start);
    const end = minutesOf(shift.end);
    const roll = random();

    if (roll < 0.03) continue; // no-show
    let clockIn: Date | null = at(shift.date, start + between(-8, 4));
    let clockOut: Date | null = at(shift.date, end + between(0, 12));
    let source: AttendanceSource = shift.date < thisMonday ? AttendanceSource.csv_import : AttendanceSource.machine;

    if (roll < 0.11) clockIn = at(shift.date, start + between(6, 35)); // late
    else if (roll < 0.15) clockOut = at(shift.date, end - between(15, 60)); // left early
    else if (roll < 0.17) clockOut = null; // forgot to clock out
    else if (roll < 0.18) clockIn = null; // forgot to clock in
    else if (roll < 0.2) source = AttendanceSource.manual; // fixed by a manager

    // today only shows what has happened so far
    if (clockIn && clockIn > now) continue;
    if (clockOut && clockOut > now) clockOut = null;
    if (!clockIn && !clockOut) continue;

    punches.push({
      userId: shift.person.userId,
      branchId: branchId[shift.branch],
      clockIn,
      clockOut,
      source,
      importBatchId: source === AttendanceSource.csv_import ? await batchFor(shift.branch, shift.date) : null,
    });
  }
  await prisma.attendance.createMany({ data: punches });
  for (const [, batchId] of batches) {
    await prisma.importBatch.update({
      where: { batchId },
      data: { rowCount: punches.filter((punch) => punch.importBatchId === batchId).length },
    });
  }

  // ---------- Tasks and their instances ----------
  const onShift = (branch: BranchKey, role: RoleName, date: Date) =>
    planned.filter((s) => s.branch === branch && s.person.role === role && s.date.getTime() === date.getTime()).map((s) => s.person);

  let instanceCount = 0;
  let mediaCount = 0;

  for (const branch of Object.keys(BRANCHES) as BranchKey[]) {
    const manager = managerOf(branch);

    for (const template of [...ROUTINES, ...BRANCH_TASKS[branch]]) {
      const assignee = template.person ? staff.find((p) => p.name === template.person)! : null;
      const task = await prisma.task.create({
        data: {
          title: template.title,
          description: template.description,
          branchId: branchId[branch],
          assignedTo: assignee?.userId ?? null,
          assignedRoleId: template.role ? roleId(template.role) : null,
          assignedBy: template.self ? assignee!.userId : manager.userId,
          origin: template.self ? TaskOrigin.self : TaskOrigin.assigned,
          isRecurring: template.recurrence !== undefined,
          recurrence: template.recurrence ?? null,
          active: !template.inactive,
          createdAt: addDays(rangeStart, -7),
        },
      });

      // Routines run to the end of the span too. Note the daily top-up job (npm run job:top-up) keeps
      // only today + 14 days of pending routine instances, so running it trims the far end.
      const retiredOn = day(-8);
      const dueDates = template.recurrence
        ? template.inactive
          ? retiredOn < rangeStart ? [] : getDates(template.recurrence, rangeStart, retiredOn)
          : getDates(template.recurrence, rangeStart, rangeEnd)
        : [day(template.due!)];

      const rows = dueDates.map((dueDate) => {
        const offset = offsetOf(dueDate);
        const roll = random();

        let status: TaskStatus = TaskStatus.pending;
        if (offset < -2) status = roll < 0.8 ? TaskStatus.verified : roll < 0.87 ? TaskStatus.rejected : roll < 0.9 ? TaskStatus.completed : TaskStatus.pending;
        else if (offset < 0) status = roll < 0.5 ? TaskStatus.verified : roll < 0.85 ? TaskStatus.completed : roll < 0.9 ? TaskStatus.rejected : TaskStatus.pending;
        else if (offset === 0) status = roll < 0.45 ? TaskStatus.completed : TaskStatus.pending;

        const completer = assignee ?? (template.role ? pick(onShift(branch, template.role, dueDate)) : undefined);
        const completedAt = at(dueDate, between(...template.window));
        if (status !== TaskStatus.pending && (!completer || completedAt > now)) status = TaskStatus.pending;

        // nobody reviews their own work: the owner reviews the manager's
        const reviewer = completer?.userId === manager.userId ? owner : manager;
        const reviewedAt = new Date(completedAt.getTime() + between(20, 180) * 60_000);
        // a review that would land later today hasn't happened yet: still awaiting review
        if ((status === TaskStatus.verified || status === TaskStatus.rejected) && reviewedAt > now) status = TaskStatus.completed;

        const done = status !== TaskStatus.pending;
        const reviewed = status === TaskStatus.verified || status === TaskStatus.rejected;
        return {
          taskId: task.taskId,
          dueDate,
          status,
          completedBy: done ? completer!.userId : null,
          completedAt: done ? completedAt : null,
          reviewedBy: reviewed ? reviewer.userId : null,
          reviewedAt: reviewed ? reviewedAt : null,
          createdAt: day(Math.min(offset, 0) - 1),
        };
      });

      const instances = await prisma.taskInstance.createManyAndReturn({ data: rows });
      const photos = instances
        .filter((instance) => instance.completedBy !== null)
        .map((instance) => ({
          taskInstanceId: instance.instanceId,
          filePath: photoKey(template.photo),
          uploadedBy: instance.completedBy!,
          serverTimestamp: instance.completedAt!,
        }));
      await prisma.media.createMany({ data: photos });
      instanceCount += instances.length;
      mediaCount += photos.length;
    }
  }

  logger.info(
    {
      users: users.length,
      shifts: planned.length,
      attendance: punches.length,
      importBatches: batches.size,
      taskInstances: instanceCount,
      photos: mediaCount,
      password: DEMO_PASSWORD,
    },
    "Demo seed complete — accounts are in docs/demo-accounts.md",
  );
}

main()
  .catch((e) => {
    logger.error({ err: e }, "Seed failed");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
