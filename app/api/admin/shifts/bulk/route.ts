import { apiError, requireAdmin, requireUnlockedDate } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

function tokyoDate(date: string) {
  return new Date(`${date}T00:00:00+09:00`);
}

function tokyoMonthRange(ym: string) {
  const [year, month] = ym.split("-").map(Number);
  const start = tokyoDate(`${year}-${String(month).padStart(2, "0")}-01`);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = tokyoDate(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01`);
  return { start, end };
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isValidYm(ym: string) {
  return /^\d{4}-\d{2}$/.test(ym);
}

async function requireUnlockedMonth(companyId: string, start: Date, end: Date) {
  for (let date = new Date(start); date < end; date = addDays(date, 1)) {
    const lockError = await requireUnlockedDate(companyId, date, "シフト");
    if (lockError) return lockError;
  }
  return null;
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));
  const ym = String(body.ym ?? "");
  if (!isValidYm(ym)) {
    return apiError("対象年月が正しくありません。", 400);
  }

  const { start, end } = tokyoMonthRange(ym);
  const lockError = await requireUnlockedMonth(session.user.companyId, start, end);
  if (lockError) return lockError;

  const shifts = Array.isArray(body.shifts) ? body.shifts : [];
  const events = Array.isArray(body.events) ? body.events : [];

  // MVP仕様: 対象月の既存シフトを削除し、画面上の内容で再作成する。
  await prisma.shift.deleteMany({
    where: {
      companyId: session.user.companyId,
      workDate: { gte: start, lt: end }
    }
  });

  if (shifts.length > 0) {
    const workPatterns = await prisma.workPattern.findMany({
      where: {
        companyId: session.user.companyId,
        id: { in: shifts.map((s: any) => s.workPatternId).filter(Boolean) }
      }
    });
    const workPatternMap = new Map(workPatterns.map((pattern) => [pattern.id, pattern]));

    await prisma.shift.createMany({
      data: shifts.map((s: any) => {
        const pattern = s.workPatternId ? workPatternMap.get(s.workPatternId) : null;

        return {
          companyId: session.user.companyId,
          userId: s.userId,
          workDate: tokyoDate(s.workDate),
          startTime: pattern?.startTime ?? s.startTime,
          endTime: pattern?.endTime ?? s.endTime,
          breakMinutes: Number(pattern?.breakMinutes ?? s.breakMinutes ?? 60),
          patternCode: pattern?.code ?? s.patternCode ?? s.code ?? null,
          workPatternId: pattern?.id ?? null
        };
      })
    });
  }

  const eventData = events
    .map((event: any) => ({
      companyId: session.user.companyId,
      workDate: tokyoDate(event.workDate),
      title: String(event.title ?? "").trim()
    }))
    .filter((event: any) => event.title);

  try {
    await prisma.shiftEvent.deleteMany({
      where: {
        companyId: session.user.companyId,
        workDate: { gte: start, lt: end }
      }
    });

    if (eventData.length > 0) {
      await prisma.shiftEvent.createMany({ data: eventData });
    }
  } catch {
    // ShiftEvent may not exist until prisma db push is run in production.
  }

  return Response.json({ ok: true, count: shifts.length, eventCount: eventData.length });
}
