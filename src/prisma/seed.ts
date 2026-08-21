import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, TaskOrigin, TaskStatus, AttendanceSource } from "@prisma/client";
import dotenv from "dotenv";
import { machineTimeToUtc } from "@/lib/machine-time";
import { logger } from "@/lib/logger";

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// time-only values only care about the HH:MM:SS portion; date part is ignored by @db.Time
const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`);
const date = (yyyyMmDd: string) => new Date(`${yyyyMmDd}T00:00:00Z`);

// A clock-machine reading, written the way the machine prints it: local wall clock at the branch.
// `attendance.clock_in` is `timestamptz`, so the reading has to be resolved to the instant it
// actually happened -- the same conversion the CSV importer applies on the way in. Writing the UTC
// literal directly is how these rows previously sat three hours from the shifts they belong to,
// which made every seeded punch read as three hours late.
const punch = (yyyyMmDd: string, hhmm: string) => {
  const [year, month, day] = yyyyMmDd.split("-").map(Number);
  const [hours, minutes] = hhmm.split(":").map(Number);

  return machineTimeToUtc(year, month, day, hours, minutes);
};

async function main() {
  // wipe in FK-safe (child -> parent) order so this script is re-runnable
  await prisma.media.deleteMany();
  await prisma.taskInstance.deleteMany();
  await prisma.task.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.register.deleteMany();
  await prisma.userBranch.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.role.deleteMany();

  // ---------- Roles ----------
  // "owner" is checked by name in src/lib/rbac.ts (OWNER_ROLE) — unrestricted, unlike "manager".
  const ownerRole = await prisma.role.create({ data: { name: "owner" } });
  const managerRole = await prisma.role.create({ data: { name: "manager" } });
  const cashierRole = await prisma.role.create({ data: { name: "cashier" } });
  const stockerRole = await prisma.role.create({ data: { name: "stocker" } });

  // ---------- Branches ----------
  const mainBranch = await prisma.branch.create({
    data: { name: "Main Branch", location: "123 Market St" },
  });
  const downtownBranch = await prisma.branch.create({
    data: { name: "Downtown Branch", location: "456 Elm St" },
  });

  // ---------- Users ----------
  // No user_branches link — owner's access isn't scoped by branch links at all (see rbac.ts).
  await prisma.user.create({
    data: { name: "Olivia Owner", phone: "555-0099", passwordHash: "placeholder-hash", roleId: ownerRole.roleId },
  });
  const alice = await prisma.user.create({
    data: { name: "Alice Manager", phone: "555-0100", passwordHash: "placeholder-hash", roleId: managerRole.roleId },
  });
  const diana = await prisma.user.create({
    data: { name: "Diana Manager", phone: "555-0101", passwordHash: "placeholder-hash", roleId: managerRole.roleId },
  });
  const bob = await prisma.user.create({
    data: { name: "Bob Cashier", phone: "555-0102", passwordHash: "placeholder-hash", roleId: cashierRole.roleId },
  });
  const carol = await prisma.user.create({
    data: { name: "Carol Cashier", phone: "555-0103", passwordHash: "placeholder-hash", roleId: cashierRole.roleId },
  });
  const ethan = await prisma.user.create({
    data: { name: "Ethan Cashier", phone: "555-0104", passwordHash: "placeholder-hash", roleId: cashierRole.roleId },
  });
  const frank = await prisma.user.create({
    data: { name: "Frank Stocker", phone: "555-0105", passwordHash: "placeholder-hash", roleId: stockerRole.roleId },
  });
  const grace = await prisma.user.create({
    data: {
      name: "Grace Stocker",
      phone: "555-0106",
      passwordHash: "placeholder-hash",
      roleId: stockerRole.roleId,
      isActive: false,
    },
  });

  // ---------- User <-> Branch links (with clock-in machine numbers) ----------
  await prisma.userBranch.createMany({
    data: [
      { userId: alice.userId, branchId: mainBranch.branchId, machineEmployeeId: "MGR-1" },
      { userId: diana.userId, branchId: downtownBranch.branchId, machineEmployeeId: "MGR-2" },
      { userId: bob.userId, branchId: mainBranch.branchId, machineEmployeeId: "CSH-1" },
      { userId: carol.userId, branchId: mainBranch.branchId, machineEmployeeId: "CSH-2" },
      { userId: ethan.userId, branchId: downtownBranch.branchId, machineEmployeeId: "CSH-3" },
      { userId: frank.userId, branchId: mainBranch.branchId, machineEmployeeId: "STK-1" },
      { userId: grace.userId, branchId: downtownBranch.branchId, machineEmployeeId: "STK-2" },
    ],
  });

  // ---------- Registers ----------
  const mainRegister1 = await prisma.register.create({
    data: { branchId: mainBranch.branchId, name: "Register 1" },
  });
  const mainRegister2 = await prisma.register.create({
    data: { branchId: mainBranch.branchId, name: "Register 2" },
  });
  const downtownRegister1 = await prisma.register.create({
    data: { branchId: downtownBranch.branchId, name: "Register 1" },
  });

  // ---------- Shifts ----------
  await prisma.shift.createMany({
    data: [
      {
        userId: bob.userId,
        branchId: mainBranch.branchId,
        registerId: mainRegister1.registerId,
        shiftDate: date("2026-07-21"),
        startTime: time("09:00"),
        endTime: time("17:00"),
        createdBy: alice.userId,
      },
      {
        userId: carol.userId,
        branchId: mainBranch.branchId,
        registerId: mainRegister2.registerId,
        shiftDate: date("2026-07-21"),
        startTime: time("12:00"),
        endTime: time("20:00"),
        createdBy: alice.userId,
      },
      {
        userId: frank.userId,
        branchId: mainBranch.branchId,
        registerId: null,
        shiftDate: date("2026-07-21"),
        startTime: time("06:00"),
        endTime: time("14:00"),
        createdBy: alice.userId,
      },
      {
        userId: ethan.userId,
        branchId: downtownBranch.branchId,
        registerId: downtownRegister1.registerId,
        shiftDate: date("2026-07-22"),
        startTime: time("09:00"),
        endTime: time("17:00"),
        createdBy: diana.userId,
      },
    ],
  });

  // ---------- Import batch + attendance ----------
  const importBatch = await prisma.importBatch.create({
    data: {
      fileName: "main_branch_attendance_week30.csv",
      importedBy: alice.userId,
      rowCount: 2,
    },
  });

  await prisma.attendance.createMany({
    data: [
      {
        userId: bob.userId,
        branchId: mainBranch.branchId,
        clockIn: punch("2026-07-21", "09:02"),
        clockOut: punch("2026-07-21", "17:05"),
        source: AttendanceSource.csv_import,
        importBatchId: importBatch.batchId,
      },
      {
        userId: carol.userId,
        branchId: mainBranch.branchId,
        clockIn: punch("2026-07-21", "12:01"),
        clockOut: punch("2026-07-21", "20:03"),
        source: AttendanceSource.csv_import,
        importBatchId: importBatch.batchId,
      },
      {
        userId: frank.userId,
        branchId: mainBranch.branchId,
        clockIn: punch("2026-07-21", "06:00"),
        clockOut: null,
        source: AttendanceSource.manual,
        importBatchId: null,
      },
    ],
  });

  // ---------- Tasks ----------
  const restockTask = await prisma.task.create({
    data: {
      title: "Restock shelves",
      description: "Restock the front aisle shelves before opening.",
      branchId: mainBranch.branchId,
      assignedTo: bob.userId,
      assignedBy: alice.userId,
      origin: TaskOrigin.assigned,
      isRecurring: true,
      recurrence: "daily",
    },
  });

  const cleanRegistersTask = await prisma.task.create({
    data: {
      title: "Clean registers",
      description: "Wipe down and sanitize all registers at closing.",
      branchId: mainBranch.branchId,
      assignedRoleId: stockerRole.roleId,
      assignedBy: alice.userId,
      origin: TaskOrigin.assigned,
      isRecurring: true,
      recurrence: "daily",
    },
  });

  const selfOrganizeTask = await prisma.task.create({
    data: {
      title: "Organize back room",
      description: "Tidy up stock in the back room.",
      branchId: mainBranch.branchId,
      assignedTo: carol.userId,
      assignedBy: carol.userId,
      origin: TaskOrigin.self,
    },
  });

  const downtownTask = await prisma.task.create({
    data: {
      title: "Inventory count",
      description: "Count and log inventory for the weekly report.",
      branchId: downtownBranch.branchId,
      assignedTo: ethan.userId,
      assignedBy: diana.userId,
      origin: TaskOrigin.assigned,
    },
  });

  // ---------- Task instances (covering pending / completed / verified / rejected) ----------
  const restockInstance = await prisma.taskInstance.create({
    data: {
      taskId: restockTask.taskId,
      dueDate: date("2026-07-21"),
      status: TaskStatus.verified,
      completedBy: bob.userId,
      completedAt: new Date("2026-07-21T16:45:00Z"),
      reviewedBy: alice.userId,
      reviewedAt: new Date("2026-07-21T17:10:00Z"),
    },
  });

  await prisma.taskInstance.create({
    data: {
      taskId: cleanRegistersTask.taskId,
      dueDate: date("2026-07-21"),
      status: TaskStatus.pending,
    },
  });

  await prisma.taskInstance.create({
    data: {
      taskId: selfOrganizeTask.taskId,
      dueDate: date("2026-07-21"),
      status: TaskStatus.rejected,
      completedBy: carol.userId,
      completedAt: new Date("2026-07-21T19:30:00Z"),
      reviewedBy: alice.userId,
      reviewedAt: new Date("2026-07-21T19:45:00Z"),
    },
  });

  await prisma.taskInstance.create({
    data: {
      taskId: downtownTask.taskId,
      dueDate: date("2026-07-22"),
      status: TaskStatus.pending,
    },
  });

  // ---------- Media (photo proof on the verified instance) ----------
  await prisma.media.create({
    data: {
      taskInstanceId: restockInstance.instanceId,
      filePath: "/uploads/restock-shelves-2026-07-21.jpg",
      uploadedBy: bob.userId,
    },
  });

  // ---------- Today-relative instances ----------
  // The fixed dates above keep a stable history to look at; these make the endpoints usable
  // straight after seeding, since GET /api/task-instances?date= is normally asked about today.
  const today = new Date();
  const dayOffset = (days: number) =>
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + days));

  // due today, untouched — the worker's list
  await prisma.taskInstance.create({
    data: {
      taskId: restockTask.taskId,
      dueDate: dayOffset(0),
      status: TaskStatus.pending,
    },
  });

  // done today, waiting on a manager — exercises the review endpoint
  const awaitingReview = await prisma.taskInstance.create({
    data: {
      taskId: cleanRegistersTask.taskId,
      dueDate: dayOffset(0),
      status: TaskStatus.completed,
      completedBy: frank.userId,
      completedAt: new Date(),
    },
  });

  await prisma.media.create({
    data: {
      taskInstanceId: awaitingReview.instanceId,
      filePath: "/uploads/clean-registers-today.jpg",
      uploadedBy: frank.userId,
    },
  });

  // yesterday, never done — the overdue case
  await prisma.taskInstance.create({
    data: {
      taskId: restockTask.taskId,
      dueDate: dayOffset(-1),
      status: TaskStatus.pending,
    },
  });

  // tomorrow, at the other branch
  await prisma.taskInstance.create({
    data: {
      taskId: downtownTask.taskId,
      dueDate: dayOffset(1),
      status: TaskStatus.pending,
    },
  });
}

main()
  .catch((e) => {
    logger.error({ err: e }, 'Seed failed');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
