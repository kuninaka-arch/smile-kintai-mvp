import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const workDate = new Date(`${body.workDate}T00:00:00`);

  const existing = await prisma.shift.findFirst({
    where: {
      companyId: session.user.companyId,
      userId: body.userId,
      workDate
    }
  });

  if (existing) {
    await prisma.shift.update({
      where: { id: existing.id },
      data: {
        startTime: body.startTime,
        endTime: body.endTime,
        breakMinutes: body.breakMinutes ?? 60
      }
    });
  } else {
    await prisma.shift.create({
      data: {
        companyId: session.user.companyId,
        userId: body.userId,
        workDate,
        startTime: body.startTime,
        endTime: body.endTime,
        breakMinutes: body.breakMinutes ?? 60
      }
    });
  }

  return NextResponse.json({ ok: true });
}
