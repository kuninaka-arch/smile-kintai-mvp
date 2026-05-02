import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { LeaveRequestUnit } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const leaveType = await prisma.leaveTypeMaster.findFirst({
    where: { id: body.leaveTypeId, companyId: session.user.companyId, isActive: true }
  });
  if (!leaveType) return NextResponse.json({ error: "休暇種別が見つかりません。" }, { status: 400 });

  const unit = body.unit === "HOUR" ? LeaveRequestUnit.HOUR : LeaveRequestUnit.FULL_DAY;
  if (unit === LeaveRequestUnit.HOUR && !leaveType.allowHourly) {
    return NextResponse.json({ error: "この休暇種別は時間単位で申請できません。" }, { status: 400 });
  }

  const hours = unit === LeaveRequestUnit.HOUR ? Number(body.hours ?? 0) : null;
  if (unit === LeaveRequestUnit.HOUR && (!hours || hours <= 0)) {
    return NextResponse.json({ error: "時間数を入力してください。" }, { status: 400 });
  }

  await prisma.leaveRequest.create({
    data: {
      companyId: session.user.companyId,
      userId: session.user.id,
      leaveTypeId: leaveType.id,
      targetDate: new Date(`${body.targetDate}T00:00:00`),
      unit,
      hours,
      reason: body.reason
    }
  });

  return NextResponse.json({ ok: true });
}
