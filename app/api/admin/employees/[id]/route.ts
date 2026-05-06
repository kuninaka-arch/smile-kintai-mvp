import { Role } from "@prisma/client";
import { logAction } from "@/lib/audit-log";
import { apiError, requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

function withoutPasswordHash<T extends { passwordHash?: string }>(user: T) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));

  const target = await prisma.user.findFirst({
    where: { id: params.id, companyId: session.user.companyId }
  });
  if (!target) return apiError("対象社員が見つかりません。", 404);

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

  const updated = await prisma.user.update({
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

  await logAction({
    request: req,
    userId: session.user.id,
    companyId: session.user.companyId,
    action: "UPDATE_EMPLOYEE",
    targetType: "EMPLOYEE",
    targetId: updated.id,
    before: withoutPasswordHash(target),
    after: withoutPasswordHash(updated),
    meta: { roleMasterId: roleMaster?.id ?? null, positionMasterId: positionMaster?.id ?? null }
  });

  return Response.json({ ok: true });
}
