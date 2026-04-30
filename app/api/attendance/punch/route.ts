import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { AttendanceType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { typeLabel } from "@/lib/attendance";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const type = body.type as AttendanceType;

  if (!["CLOCK_IN", "CLOCK_OUT", "BREAK_START", "BREAK_END"].includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
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
    time: log.stampedAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
  });
}
