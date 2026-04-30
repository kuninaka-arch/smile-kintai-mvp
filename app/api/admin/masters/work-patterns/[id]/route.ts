import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const item = await prisma.workPattern.findFirst({
    where: { id: params.id, companyId: session.user.companyId }
  });

  if (!item) return NextResponse.json({ error: "対象が見つかりません。" }, { status: 404 });

  await prisma.workPattern.update({
    where: { id: params.id },
    data: {
      code: body.code,
      name: body.name,
      startTime: body.startTime,
      endTime: body.endTime,
      breakMinutes: Number(body.breakMinutes ?? 60),
      colorClass: body.colorClass ?? "bg-emerald-400 text-slate-900",
      isHoliday: Boolean(body.isHoliday),
      sortOrder: Number(body.sortOrder ?? 0),
      isActive: Boolean(body.isActive)
    }
  });

  return NextResponse.json({ ok: true });
}
