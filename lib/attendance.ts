import { AttendanceLog, AttendanceType } from "@prisma/client";

const jaDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const jaTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

export function typeLabel(type: AttendanceType) {
  switch (type) {
    case "CLOCK_IN": return "出勤";
    case "CLOCK_OUT": return "退勤";
    case "BREAK_START": return "休憩開始";
    case "BREAK_END": return "休憩終了";
  }
}

export function formatJaDate(date: Date) {
  return jaDateFormatter.format(date);
}

export function formatJaTime(date: Date) {
  return jaTimeFormatter.format(date);
}

export function formatJaDateTime(date: Date) {
  return `${formatJaDate(date)} ${formatJaTime(date)}`;
}

export function toJaDateKey(date: Date) {
  const parts = jaDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function dateToJaMinutes(date: Date) {
  const parts = jaTimeFormatter.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
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
