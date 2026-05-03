import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.name || !body.email || !body.password) {
    return NextResponse.json({ error: "必須項目が不足しています。" }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { email: body.email } });
  if (exists) return NextResponse.json({ error: "このメールアドレスは登録済みです。" }, { status: 400 });

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

  const passwordHash = await bcrypt.hash(body.password, 10);
  const displayOrder = Number.parseInt(String(body.displayOrder ?? "0"), 10);
  const user = await prisma.user.create({
    data: {
      companyId: session.user.companyId,
      name: body.name,
      email: body.email,
      department: body.department || null,
      displayOrder: Number.isFinite(displayOrder) ? displayOrder : 0,
      positionMasterId: positionMaster?.id ?? null,
      role: roleMaster?.code === "ADMIN" || body.role === "ADMIN" ? Role.ADMIN : Role.EMPLOYEE,
      roleMasterId: roleMaster?.id ?? null,
      passwordHash
    }
  });

  await prisma.paidLeave.create({
    data: { companyId: session.user.companyId, userId: user.id, grantedDays: 10, usedDays: 0 }
  });

  return NextResponse.json({ ok: true });
}
