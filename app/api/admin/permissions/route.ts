import { NextResponse } from "next/server";
import { logAction } from "@/lib/audit-log";
import { apiError, requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));
  const roleMasterId = String(body.roleMasterId ?? "");
  const feature = String(body.feature ?? "").trim();
  if (!roleMasterId || !feature) return apiError("ロールと機能を指定してください。", 400);

  const role = await prisma.roleMaster.findFirst({
    where: { id: roleMasterId, companyId: session.user.companyId }
  });
  if (!role) return apiError("ロールが見つかりません。", 404);

  const before = await prisma.rolePermission.findUnique({
    where: { roleMasterId_feature: { roleMasterId, feature } }
  });

  const permission = await prisma.rolePermission.upsert({
    where: { roleMasterId_feature: { roleMasterId, feature } },
    update: {
      canView: Boolean(body.canView),
      canCreate: Boolean(body.canCreate),
      canEdit: Boolean(body.canEdit),
      canDelete: Boolean(body.canDelete),
      canApprove: Boolean(body.canApprove),
      canExportCsv: Boolean(body.canExportCsv),
      canExportPdf: Boolean(body.canExportPdf),
      canExportExcel: Boolean(body.canExportExcel),
      canManagePermission: Boolean(body.canManagePermission)
    },
    create: {
      companyId: session.user.companyId,
      roleMasterId,
      feature,
      canView: Boolean(body.canView),
      canCreate: Boolean(body.canCreate),
      canEdit: Boolean(body.canEdit),
      canDelete: Boolean(body.canDelete),
      canApprove: Boolean(body.canApprove),
      canExportCsv: Boolean(body.canExportCsv),
      canExportPdf: Boolean(body.canExportPdf),
      canExportExcel: Boolean(body.canExportExcel),
      canManagePermission: Boolean(body.canManagePermission)
    }
  });

  await logAction({
    request: req,
    userId: session.user.id,
    companyId: session.user.companyId,
    action: before ? "UPDATE_ROLE_PERMISSION" : "CREATE_ROLE_PERMISSION",
    targetType: "ROLE_PERMISSION",
    targetId: permission.id,
    before,
    after: permission,
    meta: { roleCode: role.code, feature }
  });

  return NextResponse.json({ ok: true });
}
