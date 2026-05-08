import { NextResponse } from "next/server";
import { logAction } from "@/lib/audit-log";
import { apiError, requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getCompanyClosingDay, periodRangeForYm } from "@/lib/period-lock";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json();
  const ym = String(body.ym ?? "");
  if (!/^\d{4}-\d{2}$/.test(ym)) {
    return apiError("対象年月が不正です。", 400);
  }

  const closingDay = await getCompanyClosingDay(session.user.companyId);
  const range = periodRangeForYm(ym, closingDay);
  const locked = Boolean(body.locked);
  const now = new Date();
  const before = await prisma.attendancePeriodLock.findUnique({
    where: { companyId_periodKey: { companyId: session.user.companyId, periodKey: range.periodKey } }
  });

  const updated = await prisma.attendancePeriodLock.upsert({
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

  await logAction({
    request: req,
    userId: session.user.id,
    companyId: session.user.companyId,
    action: locked ? "LOCK_PERIOD" : "UNLOCK_PERIOD",
    targetType: "PERIOD_LOCK",
    targetId: updated.id,
    before,
    after: updated,
    meta: {
      ym,
      periodKey: range.periodKey,
      periodStart: range.periodStart,
      periodEnd: range.periodEnd,
      closingDay: range.closingDay
    }
  });

  return NextResponse.json({ ok: true });
}
