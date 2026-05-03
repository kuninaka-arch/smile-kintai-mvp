import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { AttendanceType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDateLocked } from "@/lib/period-lock";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const targetDate = new Date(`${body.targetDate}T00:00:00+09:00`);
  const requestedAt = new Date(`${body.targetDate}T${body.requestedTime}:00+09:00`);
  if (await isDateLocked(session.user.companyId, targetDate)) {
    return NextResponse.json({ error: "締め済み期間のため、打刻修正申請はできません。" }, { status: 423 });
  }

  await prisma.attendanceCorrectionRequest.create({
    data: {
      companyId: session.user.companyId,
      userId: session.user.id,
      targetDate,
      requestedAt,
      requestedType: body.requestedType as AttendanceType,
      reason: body.reason
    }
  });

  return NextResponse.json({ ok: true });
}
