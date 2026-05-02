import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { LeaveRequestStatus, LeaveRequestUnit } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function colorForLeave(code: string) {
  if (code === "PAID") return "bg-amber-200 text-slate-900";
  if (code === "COMP") return "bg-sky-200 text-slate-900";
  if (code === "BEREAVEMENT") return "bg-slate-300 text-slate-900";
  return "bg-violet-200 text-slate-900";
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const status = body.status as LeaveRequestStatus;

  const request = await prisma.leaveRequest.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
    include: { leaveType: true }
  });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
      const pattern = await tx.workPattern.upsert({
        where: { companyId_code: { companyId: request.companyId, code: request.leaveType.code } },
        update: {
          name: request.leaveType.name,
          startTime: "00:00",
          endTime: "00:00",
          breakMinutes: 0,
          isHoliday: true,
          isActive: true
        },
        create: {
          companyId: request.companyId,
          code: request.leaveType.code,
          name: request.leaveType.name,
          startTime: "00:00",
          endTime: "00:00",
          breakMinutes: 0,
          colorClass: colorForLeave(request.leaveType.code),
          isHoliday: true,
          sortOrder: 80,
          isActive: true
        }
      });

      const existingShift = await tx.shift.findFirst({
        where: { companyId: request.companyId, userId: request.userId, workDate: request.targetDate }
      });
      const shiftData = {
        startTime: "00:00",
        endTime: "00:00",
        breakMinutes: 0,
        patternCode: pattern.code,
        workPatternId: pattern.id
      };
      if (existingShift) {
        await tx.shift.update({ where: { id: existingShift.id }, data: shiftData });
      } else {
        await tx.shift.create({
          data: {
            companyId: request.companyId,
            userId: request.userId,
            workDate: request.targetDate,
            ...shiftData
          }
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}
