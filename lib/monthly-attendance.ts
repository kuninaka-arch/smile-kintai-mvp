import { calcDailyWorkMinutes, toJaDateKey } from "@/lib/attendance";

type LogLike = {
  type: string;
  stampedAt: Date;
};

type ShiftLike = {
  workDate: Date;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  patternCode: string | null;
  workPattern: {
    name: string;
    isHoliday: boolean;
  } | null;
};

type LeaveLike = {
  targetDate: Date;
  unit: string;
  hours: number | null;
};

export type MonthlyAttendanceMetrics = {
  workDays: number;
  actualWorkMinutes: number;
  scheduledWorkMinutes: number;
  regularOvertimeMinutes: number;
  nightOvertimeMinutes: number;
  holidayWorkMinutes: number;
  holidayNightWorkMinutes: number;
  lateEarlyMinutes: number;
  absenceDays: number;
  nightShiftCount: number;
  semiNightShiftCount: number;
  lodgingShiftCount: number;
  leaveMinutes: number;
  totalExtraMinutes: number;
};

export function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function jaTimeMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  return Number(parts.find((part) => part.type === "hour")?.value ?? 0) * 60 + Number(parts.find((part) => part.type === "minute")?.value ?? 0);
}

function normalizeEndMinutes(start: number, end: number) {
  return end <= start ? end + 24 * 60 : end;
}

function normalizeActualMinutes(actual: number, scheduledStart: number, scheduledEnd: number) {
  const normalizedEnd = normalizeEndMinutes(scheduledStart, scheduledEnd);
  if (normalizedEnd > 24 * 60 && actual < scheduledStart) return actual + 24 * 60;
  return actual;
}

function overlapMinutes(start: number, end: number, rangeStart: number, rangeEnd: number) {
  return Math.max(0, Math.min(end, rangeEnd) - Math.max(start, rangeStart));
}

function nightMinutesFromRange(startMinutes: number, endMinutes: number) {
  const end = normalizeEndMinutes(startMinutes, endMinutes);
  return overlapMinutes(startMinutes, end, 22 * 60, 29 * 60) + overlapMinutes(startMinutes, end, 0, 5 * 60);
}

function plannedMinutes(shift: ShiftLike | null) {
  if (!shift || (shift.startTime === "00:00" && shift.endTime === "00:00")) return 0;
  const start = timeToMinutes(shift.startTime);
  const end = normalizeEndMinutes(start, timeToMinutes(shift.endTime));
  return Math.max(0, end - start - shift.breakMinutes);
}

function actualNightMinutes(logs: LogLike[]) {
  const clockIn = logs.find((log) => log.type === "CLOCK_IN");
  const clockOut = [...logs].reverse().find((log) => log.type === "CLOCK_OUT");
  if (!clockIn || !clockOut) return 0;
  return nightMinutesFromRange(jaTimeMinutes(clockIn.stampedAt), jaTimeMinutes(clockOut.stampedAt));
}

function isHolidayShift(shift: ShiftLike | null) {
  return Boolean(shift?.workPattern?.isHoliday || (shift?.startTime === "00:00" && shift?.endTime === "00:00"));
}

function isFullDayLeave(leave: LeaveLike | null) {
  return leave?.unit === "FULL_DAY";
}

function leaveMinutes(leaves: LeaveLike[]) {
  return leaves.reduce((sum, request) => {
    return sum + (request.unit === "HOUR" ? Math.round(Number(request.hours ?? 0) * 60) : 8 * 60);
  }, 0);
}

function shiftText(shift: ShiftLike | null) {
  return `${shift?.patternCode ?? ""} ${shift?.workPattern?.name ?? ""}`.toUpperCase();
}

function shiftKindCount(shift: ShiftLike | null, kind: "night" | "semiNight" | "lodging") {
  const text = shiftText(shift);
  if (kind === "semiNight") return /準夜|^SN|SEMI/.test(text) ? 1 : 0;
  if (kind === "lodging") return /宿直|宿|LODGE|STAY/.test(text) ? 1 : 0;
  return /夜勤|^N|NIGHT/.test(text) && !/準夜|^SN|SEMI/.test(text) ? 1 : 0;
}

export function summarizeMonthlyAttendance(input: {
  logs: LogLike[];
  shifts: ShiftLike[];
  leaves: LeaveLike[];
}): MonthlyAttendanceMetrics {
  const logsByDate = new Map<string, LogLike[]>();
  for (const log of input.logs) {
    const key = toJaDateKey(log.stampedAt);
    logsByDate.set(key, [...(logsByDate.get(key) ?? []), log]);
  }

  const shiftByDate = new Map(input.shifts.map((shift) => [toJaDateKey(shift.workDate), shift]));
  const leaveByDate = new Map(input.leaves.map((leave) => [toJaDateKey(leave.targetDate), leave]));
  const dateKeys = Array.from(new Set([...Array.from(logsByDate.keys()), ...Array.from(shiftByDate.keys()), ...Array.from(leaveByDate.keys())]));

  const metrics: MonthlyAttendanceMetrics = {
    workDays: 0,
    actualWorkMinutes: 0,
    scheduledWorkMinutes: 0,
    regularOvertimeMinutes: 0,
    nightOvertimeMinutes: 0,
    holidayWorkMinutes: 0,
    holidayNightWorkMinutes: 0,
    lateEarlyMinutes: 0,
    absenceDays: 0,
    nightShiftCount: 0,
    semiNightShiftCount: 0,
    lodgingShiftCount: 0,
    leaveMinutes: leaveMinutes(input.leaves),
    totalExtraMinutes: 0
  };

  for (const key of dateKeys) {
    const logs = logsByDate.get(key) ?? [];
    const shift = shiftByDate.get(key) ?? null;
    const leave = leaveByDate.get(key) ?? null;
    const actual = calcDailyWorkMinutes(logs as Parameters<typeof calcDailyWorkMinutes>[0]);
    const scheduled = plannedMinutes(shift);
    const scheduledNight = shift ? nightMinutesFromRange(timeToMinutes(shift.startTime), timeToMinutes(shift.endTime)) : 0;
    const actualNight = actualNightMinutes(logs);

    if (actual > 0) metrics.workDays += 1;
    metrics.actualWorkMinutes += actual;
    metrics.scheduledWorkMinutes += scheduled;
    metrics.nightShiftCount += shiftKindCount(shift, "night");
    metrics.semiNightShiftCount += shiftKindCount(shift, "semiNight");
    metrics.lodgingShiftCount += shiftKindCount(shift, "lodging");

    if (isHolidayShift(shift)) {
      metrics.holidayWorkMinutes += actual;
      metrics.holidayNightWorkMinutes += actualNight;
    } else {
      const nightOvertime = Math.max(0, actualNight - scheduledNight);
      metrics.nightOvertimeMinutes += nightOvertime;
      metrics.regularOvertimeMinutes += Math.max(0, actual - scheduled - nightOvertime);
    }

    if (shift && scheduled > 0) {
      const clockIn = logs.find((log) => log.type === "CLOCK_IN");
      const clockOut = [...logs].reverse().find((log) => log.type === "CLOCK_OUT");

      if (!clockIn && !clockOut && !isFullDayLeave(leave)) {
        metrics.absenceDays += 1;
      } else {
        const scheduledStart = timeToMinutes(shift.startTime);
        const scheduledEnd = normalizeEndMinutes(scheduledStart, timeToMinutes(shift.endTime));
        const lateMinutes = clockIn ? Math.max(0, jaTimeMinutes(clockIn.stampedAt) - scheduledStart) : 0;
        const earlyMinutes = clockOut
          ? Math.max(0, scheduledEnd - normalizeActualMinutes(jaTimeMinutes(clockOut.stampedAt), scheduledStart, timeToMinutes(shift.endTime)))
          : 0;
        metrics.lateEarlyMinutes += lateMinutes + earlyMinutes;
      }
    }
  }

  metrics.totalExtraMinutes = metrics.regularOvertimeMinutes + metrics.nightOvertimeMinutes + metrics.holidayWorkMinutes;
  return metrics;
}
