import { NextResponse } from "next/server";
import { apiError, requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json();
  const workDate = new Date(`${body.workDate}T00:00:00`);
  const user = await prisma.user.findFirst({
    where: {
      id: body.userId,
      companyId: session.user.companyId
    },
    select: { id: true }
  });

  if (!user) {
    return apiError("対象社員が見つかりません。", 404);
  }

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
