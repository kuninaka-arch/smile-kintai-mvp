import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCompanyClosingDay, periodRangeForYm } from "@/lib/period-lock";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const ym = String(body.ym ?? "");
  if (!/^\d{4}-\d{2}$/.test(ym)) {
    return NextResponse.json({ error: "対象年月が不正です。" }, { status: 400 });
  }

  const closingDay = await getCompanyClosingDay(session.user.companyId);
  const range = periodRangeForYm(ym, closingDay);
  const locked = Boolean(body.locked);
  const now = new Date();

  await prisma.attendancePeriodLock.upsert({
    where: { companyId_periodKey: { companyId: session.user.companyId, periodKey: range.periodKey } },
    update: {
      periodStart: range.periodStart,
      periodEnd: range.periodEnd,
      closingDay: range.closingDay,
      locked,
      lockedAt: locked ? now : null,
      lockedByUserId: locked ? session.user.id : null,
      unlockedAt: locked ? null : now,
      unlockedByUserId: locked ? null : session.user.id
    },
    create: {
      companyId: session.user.companyId,
      periodKey: range.periodKey,
      periodStart: range.periodStart,
      periodEnd: range.periodEnd,
      closingDay: range.closingDay,
      locked,
      lockedAt: locked ? now : null,
      lockedByUserId: locked ? session.user.id : null,
      unlockedAt: locked ? null : now,
      unlockedByUserId: locked ? null : session.user.id
    }
  });

  return NextResponse.json({ ok: true });
}
