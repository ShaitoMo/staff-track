-- A punch must end after it starts. AttendanceService.updateAttendance already refuses this, but
-- against a row read before the write: two edits saved at once — one moving the clock-in later,
-- the other the clock-out earlier — could each pass alone and together invert the punch. This is
-- the database's half of that rule; Prisma can't express it, so it lives here only.
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_clock_out_after_in"
    CHECK ("clock_in" IS NULL OR "clock_out" IS NULL OR "clock_out" > "clock_in");
