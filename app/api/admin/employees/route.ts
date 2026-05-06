import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { logAction } from "@/lib/audit-log";
import { apiError, requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));
  if (!body.name || !body.email || !body.password) {
    return apiError("必須項目が不足しています。", 400);
  }

  const exists = await prisma.user.findUnique({ where: { email: body.email } });
  if (exists) return apiError("このメールアドレスは登録済みです。", 400);

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
  const monthlyScheduledHours = Number(body.monthlyScheduledHours ?? 0);
  const user = await prisma.user.create({
    data: {
      companyId: session.user.companyId,
      name: String(body.name),
      email: String(body.email),
      department: body.department || null,
      displayOrder: Number.isFinite(displayOrder) ? displayOrder : 0,
      positionMasterId: positionMaster?.id ?? null,
      jobType: body.jobType || null,
      isFullTime: Boolean(body.isFullTime),
      monthlyScheduledMinutes: Number.isFinite(monthlyScheduledHours) && monthlyScheduledHours > 0 ? Math.round(monthlyScheduledHours * 60) : null,
      role: roleMaster?.code === "ADMIN" || body.role === "ADMIN" ? Role.ADMIN : Role.EMPLOYEE,
      roleMasterId: roleMaster?.id ?? null,
      passwordHash
    }
  });

  await prisma.paidLeave.create({
    data: { companyId: session.user.companyId, userId: user.id, grantedDays: 10, usedDays: 0 }
  });

  const { passwordHash: _passwordHash, ...safeUser } = user;
  await logAction({
    request: req,
    userId: session.user.id,
    companyId: session.user.companyId,
    action: "CREATE_EMPLOYEE",
    targetType: "EMPLOYEE",
    targetId: user.id,
    after: safeUser,
    meta: { roleMasterId: roleMaster?.id ?? null, positionMasterId: positionMaster?.id ?? null }
  });

  return Response.json({ ok: true });
}
