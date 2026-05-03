import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { CorrectionStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDateLocked } from "@/lib/period-lock";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const status = body.status as CorrectionStatus;

  const request = await prisma.attendanceCorrectionRequest.findFirst({
    where: { id: params.id, companyId: session.user.companyId }
  });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (await isDateLocked(session.user.companyId, request.targetDate)) {
    return NextResponse.json({ error: "締め済み期間のため、打刻修正申請は変更できません。" }, { status: 423 });
  }

  await prisma.attendanceCorrectionRequest.update({
    where: { id: params.id },
    data: { status }
  });

  if (status === "APPROVED") {
    await prisma.attendanceLog.create({
      data: {
        companyId: request.companyId,
        userId: request.userId,
        type: request.requestedType,
        stampedAt: request.requestedAt,
        note: "打刻修正申請により追加"
      }
    });
  }

  return NextResponse.json({ ok: true });
}
