import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const ym = body.ym as string;
  const [year, month] = ym.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const shifts = Array.isArray(body.shifts) ? body.shifts : [];

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
          workDate: new Date(`${s.workDate}T00:00:00`),
          startTime: pattern?.startTime ?? s.startTime,
          endTime: pattern?.endTime ?? s.endTime,
          breakMinutes: Number(pattern?.breakMinutes ?? s.breakMinutes ?? 60),
          patternCode: pattern?.code ?? s.patternCode ?? s.code ?? null,
          workPatternId: pattern?.id ?? null
        };
      })
    });
  }

  return NextResponse.json({ ok: true, count: shifts.length });
}
