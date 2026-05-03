import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPeriodLock } from "@/lib/period-lock";

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

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const ym = body.ym as string;
  const period = await getPeriodLock(session.user.companyId, ym);
  if (period.locked) {
    return NextResponse.json({ error: "締め済み期間のため、シフトは変更できません。" }, { status: 423 });
  }
  const { start, end } = tokyoMonthRange(ym);

  const shifts = Array.isArray(body.shifts) ? body.shifts : [];
  const events = Array.isArray(body.events) ? body.events : [];

  // 対象月の既存シフトを一度削除し、一括再登録するMVP仕様
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

  return NextResponse.json({ ok: true, count: shifts.length, eventCount: eventData.length });
}
