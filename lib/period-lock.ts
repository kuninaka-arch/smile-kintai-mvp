import { prisma } from "@/lib/prisma";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function tokyoDate(year: number, month: number, day: number) {
  return new Date(`${year}-${pad(month)}-${pad(day)}T00:00:00+09:00`);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function normalizeClosingDay(value?: number | null) {
  if (!value || value < 1) return 31;
  return Math.min(31, Math.floor(value));
}

export function periodRangeForYm(ym: string, closingDayValue?: number | null) {
  const [year, month] = ym.split("-").map(Number);
  const closingDay = normalizeClosingDay(closingDayValue);
  const endDay = closingDay >= 31 ? daysInMonth(year, month) : Math.min(closingDay, daysInMonth(year, month));
  const periodEnd = tokyoDate(year, month, endDay);

  let periodStart: Date;
  if (closingDay >= 31) {
    periodStart = tokyoDate(year, month, 1);
  } else {
    const previousMonthDate = new Date(year, month - 2, 1);
    const previousYear = previousMonthDate.getFullYear();
    const previousMonth = previousMonthDate.getMonth() + 1;
    const previousEndDay = Math.min(closingDay, daysInMonth(previousYear, previousMonth));
    periodStart = addDays(tokyoDate(previousYear, previousMonth, previousEndDay), 1);
  }

  return {
    periodKey: ym,
    periodStart,
    periodEnd,
    periodEndExclusive: addDays(periodEnd, 1),
    closingDay
  };
}

export function formatDateKey(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export async function getCompanyClosingDay(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { closingDay: true }
  });
  return normalizeClosingDay(company?.closingDay);
}

export async function getPeriodLock(companyId: string, ym: string, closingDayValue?: number | null) {
  const range = periodRangeForYm(ym, closingDayValue ?? (await getCompanyClosingDay(companyId)));
  const lock = await prisma.attendancePeriodLock.findUnique({
    where: { companyId_periodKey: { companyId, periodKey: range.periodKey } }
  });
  return { ...range, lock, locked: Boolean(lock?.locked) };
}

export async function isDateLocked(companyId: string, date: Date) {
  const lock = await prisma.attendancePeriodLock.findFirst({
    where: {
      companyId,
      locked: true,
      periodStart: { lte: date },
      periodEnd: { gte: date }
    }
  });
  return Boolean(lock);
}
