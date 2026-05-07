import { NextResponse } from "next/server";
import { logAction } from "@/lib/audit-log";
import { apiError, requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

const scopes = ["SELF", "OWN_DEPARTMENT", "SELECTED_DEPARTMENTS", "ALL_COMPANY"] as const;

function isScope(value: unknown): value is (typeof scopes)[number] {
  return typeof value === "string" && (scopes as readonly string[]).includes(value);
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId ?? "");
  const scope = body.scope;
  if (!userId || !isScope(scope)) return apiError("ユーザーと部署スコープを指定してください。", 400);

  const user = await prisma.user.findFirst({
    where: { id: userId, companyId: session.user.companyId },
    select: { id: true, name: true, email: true }
  });
  if (!user) return apiError("ユーザーが見つかりません。", 404);

  const permissionId = body.id ? String(body.id) : "";
  const before = permissionId
    ? await prisma.userDepartmentPermission.findFirst({
        where: { id: permissionId, companyId: session.user.companyId }
      })
    : null;

  const data = {
    companyId: session.user.companyId,
    userId,
    departmentId: body.departmentId || null,
    scope,
    canView: body.canView !== false,
    canEdit: Boolean(body.canEdit),
    canApprove: Boolean(body.canApprove),
    canExport: Boolean(body.canExport)
  };

  const duplicate = await prisma.userDepartmentPermission.findFirst({
    where: {
      companyId: session.user.companyId,
      userId,
      departmentId: data.departmentId,
      scope,
      ...(before ? { id: { not: before.id } } : {})
    },
    select: { id: true }
  });
  if (duplicate) {
    return apiError("同じユーザー・部署・スコープの部署権限は既に登録されています。", 400);
  }

  const permission = before
    ? await prisma.userDepartmentPermission.update({ where: { id: before.id }, data })
    : await prisma.userDepartmentPermission.create({ data });

  await logAction({
    request: req,
    userId: session.user.id,
    companyId: session.user.companyId,
    action: before ? "UPDATE_USER_DEPARTMENT_PERMISSION" : "CREATE_USER_DEPARTMENT_PERMISSION",
    targetType: "USER_DEPARTMENT_PERMISSION",
    targetId: permission.id,
    before,
    after: permission,
    meta: { targetUserEmail: user.email }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  if (!id) return apiError("削除対象を指定してください。", 400);

  const before = await prisma.userDepartmentPermission.findFirst({
    where: { id, companyId: session.user.companyId }
  });
  if (!before) return apiError("部署権限が見つかりません。", 404);

  await prisma.userDepartmentPermission.delete({ where: { id } });

  await logAction({
    request: req,
    userId: session.user.id,
    companyId: session.user.companyId,
    action: "DELETE_USER_DEPARTMENT_PERMISSION",
    targetType: "USER_DEPARTMENT_PERMISSION",
    targetId: id,
    before
  });

  return NextResponse.json({ ok: true });
}
