import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { AttendanceType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const targetDate = new Date(`${body.targetDate}T00:00:00`);
  const requestedAt = new Date(`${body.targetDate}T${body.requestedTime}:00`);

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
