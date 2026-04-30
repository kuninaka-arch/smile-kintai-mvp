import { AttendanceLog, AttendanceType } from "@prisma/client";

export function typeLabel(type: AttendanceType) {
  switch (type) {
    case "CLOCK_IN": return "出勤";
    case "CLOCK_OUT": return "退勤";
    case "BREAK_START": return "休憩開始";
    case "BREAK_END": return "休憩終了";
  }
}

export function calcDailyWorkMinutes(logs: AttendanceLog[]) {
  const sorted = [...logs].sort((a, b) => a.stampedAt.getTime() - b.stampedAt.getTime());
  const inLog = sorted.find((l) => l.type === "CLOCK_IN");
  const outLog = [...sorted].reverse().find((l) => l.type === "CLOCK_OUT");
  if (!inLog || !outLog) return 0;

  let breakMinutes = 0;
  let breakStart: Date | null = null;

  for (const log of sorted) {
    if (log.type === "BREAK_START") breakStart = log.stampedAt;
    if (log.type === "BREAK_END" && breakStart) {
      breakMinutes += Math.max(0, (log.stampedAt.getTime() - breakStart.getTime()) / 60000);
      breakStart = null;
    }
  }

  return Math.max(0, Math.round((outLog.stampedAt.getTime() - inLog.stampedAt.getTime()) / 60000 - breakMinutes));
}

export function minutesToHHMM(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}
