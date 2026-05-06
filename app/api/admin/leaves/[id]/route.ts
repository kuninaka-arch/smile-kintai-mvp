import { LeaveRequestStatus, LeaveRequestUnit, WorkPatternCategory } from "@prisma/client";
import { apiError, requireAdmin, requireUnlockedDate } from "@/lib/authz";
import { isCareCompany } from "@/lib/industry";
import { prisma } from "@/lib/prisma";

const validStatuses: LeaveRequestStatus[] = ["PENDING", "APPROVED", "REJECTED"];

function colorForLeave(code: string) {
  if (code === "PAID") return "bg-amber-200 text-slate-900";
  if (code === "COMP") return "bg-sky-200 text-slate-900";
  if (code === "BEREAVEMENT") return "bg-slate-300 text-slate-900";
  return "bg-violet-200 text-slate-900";
}

function tokyoDateKey(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function tokyoDateRange(date: Date) {
  const key = tokyoDateKey(date);
  const start = new Date(`${key}T00:00:00+09:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function leavePatternCategory(code: string, name: string) {
  const text = `${code} ${name}`.toUpperCase();
  if (/PAID|YU|有休|有給/.test(text)) return WorkPatternCategory.PAID_LEAVE;
  if (/REQUEST|HOPE|希望休/.test(text)) return WorkPatternCategory.REQUESTED_OFF;
  return WorkPatternCategory.OFF;
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));
  const status = body.status as LeaveRequestStatus;
  if (!validStatuses.includes(status)) {
    return apiError("休暇申請の処理状態が正しくありません。", 400);
  }

  const request = await prisma.leaveRequest.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
    include: { leaveType: true }
  });
  if (!request) return apiError("休暇申請が見つかりません。", 404);

  const lockError = await requireUnlockedDate(session.user.companyId, request.targetDate, "休暇申請");
  if (lockError) return lockError;

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { industryType: true }
  });
  const careMode = isCareCompany(company?.industryType);

  await prisma.$transaction(async (tx) => {
    await tx.leaveRequest.update({
      where: { id: request.id },
      data: { status, approvedAt: status === "APPROVED" ? new Date() : null }
    });

    if (status !== "APPROVED") return;

    const usedDays = request.unit === LeaveRequestUnit.HOUR
      ? Number(request.hours ?? 0) / 8
      : 1;

    const paidLeave = await tx.paidLeave.findFirst({
      where: { companyId: request.companyId, userId: request.userId }
    });
    if (paidLeave) {
      await tx.paidLeave.update({
        where: { id: paidLeave.id },
        data: { usedDays: paidLeave.usedDays + usedDays }
      });
    } else {
      await tx.paidLeave.create({
        data: { companyId: request.companyId, userId: request.userId, grantedDays: 0, usedDays }
      });
    }

    if (request.unit === LeaveRequestUnit.FULL_DAY) {
      const category = leavePatternCategory(request.leaveType.code, request.leaveType.name);
      const pattern = await tx.workPattern.upsert({
        where: { companyId_code: { companyId: request.companyId, code: request.leaveType.code } },
        update: {
          name: request.leaveType.name,
          category,
          startTime: "00:00",
          endTime: "00:00",
          breakMinutes: 0,
          isHoliday: true,
          countsAsWork: false,
          countsAsLeave: category === WorkPatternCategory.PAID_LEAVE,
          isActive: true
        },
        create: {
          companyId: request.companyId,
          code: request.leaveType.code,
          name: request.leaveType.name,
          category,
          startTime: "00:00",
          endTime: "00:00",
          breakMinutes: 0,
          colorClass: colorForLeave(request.leaveType.code),
          isHoliday: true,
          countsAsWork: false,
          countsAsLeave: category === WorkPatternCategory.PAID_LEAVE,
          sortOrder: 80,
          isActive: true
        }
      });

      const { start, end } = tokyoDateRange(request.targetDate);
      const existingShift = await tx.shift.findFirst({
        where: {
          companyId: request.companyId,
          userId: request.userId,
          workDate: { gte: start, lt: end }
        },
        orderBy: { workDate: "asc" }
      });
      const shiftData = {
        workDate: start,
        startTime: "00:00",
        endTime: "00:00",
        breakMinutes: 0,
        patternCode: pattern.code,
        workPatternId: pattern.id
      };
      if (existingShift) {
        if (careMode) return;
        await tx.shift.update({ where: { id: existingShift.id }, data: shiftData });
        await tx.shift.deleteMany({
          where: {
            companyId: request.companyId,
            userId: request.userId,
            workDate: { gte: start, lt: end },
            id: { not: existingShift.id }
          }
        });
      } else {
        await tx.shift.create({
          data: {
            companyId: request.companyId,
            userId: request.userId,
            ...shiftData
          }
        });
      }
    }
  });

  return Response.json({ ok: true });
}
