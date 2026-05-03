import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { AttendanceType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatJaTime, typeLabel } from "@/lib/attendance";
import { isDateLocked } from "@/lib/period-lock";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const type = body.type as AttendanceType;

  if (!["CLOCK_IN", "CLOCK_OUT", "BREAK_START", "BREAK_END"].includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }
  if (await isDateLocked(session.user.companyId, new Date())) {
    return NextResponse.json({ error: "締め済み期間のため、打刻できません。" }, { status: 423 });
  }

  const log = await prisma.attendanceLog.create({
    data: {
      companyId: session.user.companyId,
      userId: session.user.id,
      type,
      latitude: typeof body.latitude === "number" ? body.latitude : null,
      longitude: typeof body.longitude === "number" ? body.longitude : null
    }
  });

  return NextResponse.json({
    ok: true,
    label: typeLabel(type),
    time: formatJaTime(log.stampedAt)
  });
}
