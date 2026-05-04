import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const target = await prisma.user.findFirst({
    where: { id: params.id, companyId: session.user.companyId }
  });
  if (!target) return NextResponse.json({ error: "対象社員が見つかりません。" }, { status: 404 });

  const roleMaster = body.roleMasterId
    ? await prisma.roleMaster.findFirst({
        where: { id: body.roleMasterId, companyId: session.user.companyId, isActive: true }
      })
    : null;

  const positionMaster = body.positionMasterId
    ? await prisma.positionMaster.findFirst({
        where: { id: body.positionMasterId, companyId: session.user.companyId, isActive: true }
      })
    : null;

  const displayOrder = Number.parseInt(String(body.displayOrder ?? "0"), 10);
  const monthlyScheduledHours = Number(body.monthlyScheduledHours ?? 0);

  await prisma.user.update({
    where: { id: params.id },
    data: {
      name: body.name,
      email: body.email,
      department: body.department || null,
      displayOrder: Number.isFinite(displayOrder) ? displayOrder : 0,
      positionMasterId: positionMaster?.id ?? null,
      jobType: body.jobType || null,
      isFullTime: Boolean(body.isFullTime),
      monthlyScheduledMinutes: Number.isFinite(monthlyScheduledHours) && monthlyScheduledHours > 0 ? Math.round(monthlyScheduledHours * 60) : null,
      role: roleMaster?.code === "ADMIN" || body.role === "ADMIN" ? Role.ADMIN : Role.EMPLOYEE,
      roleMasterId: roleMaster?.id ?? null
    }
  });

  return NextResponse.json({ ok: true });
}
