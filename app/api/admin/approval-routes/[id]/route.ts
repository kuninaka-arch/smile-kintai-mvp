import { NextResponse } from "next/server";
import { assertDefaultApprovalRouteNotDuplicate, normalizeApprovalRouteDepartmentId } from "@/lib/approval-routes";
import { logAction } from "@/lib/audit-log";
import { apiError, requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

const requestTypes = [
  "ATTENDANCE_CORRECTION",
  "OVERTIME",
  "HOLIDAY_WORK",
  "NIGHT_WORK",
  "PAID_LEAVE",
  "SUBSTITUTE_LEAVE",
  "MATERNITY_LEAVE",
  "CHILDCARE_LEAVE",
  "SHORT_TIME_WORK"
] as const;

const requirements = ["ANY_ONE", "ALL_REQUIRED"] as const;
const approverTypes = ["USER", "ROLE", "DEPARTMENT_MANAGER", "COMPANY_ADMIN"] as const;

function isOneOf<T extends readonly string[]>(value: unknown, list: T): value is T[number] {
  return typeof value === "string" && list.includes(value);
}

function normalizeApprover(approver: any) {
  if (!isOneOf(approver.approverType, approverTypes)) {
    throw new Error("承認者種別が正しくありません。");
  }

  const userId = approver.userId ? String(approver.userId) : "";
  const roleMasterId = approver.roleMasterId ? String(approver.roleMasterId) : "";
  const departmentId = approver.departmentId ? String(approver.departmentId) : "";

  if (approver.approverType === "USER") {
    if (!userId || roleMasterId || departmentId) {
      throw new Error("ユーザー指定の承認者は userId のみ指定してください。");
    }
    return { approverType: approver.approverType, userId, roleMasterId: null, departmentId: null };
  }

  if (approver.approverType === "ROLE") {
    if (!roleMasterId || userId || departmentId) {
      throw new Error("ロール指定の承認者は roleMasterId のみ指定してください。");
    }
    return { approverType: approver.approverType, userId: null, roleMasterId, departmentId: null };
  }

  if (approver.approverType === "DEPARTMENT_MANAGER") {
    if (!departmentId || userId || roleMasterId) {
      throw new Error("部署上長の承認者は departmentId のみ指定してください。");
    }
    return { approverType: approver.approverType, userId: null, roleMasterId: null, departmentId };
  }

  if (userId || roleMasterId || departmentId) {
    throw new Error("会社管理者の承認者には userId / roleMasterId / departmentId を指定できません。");
  }
  return { approverType: approver.approverType, userId: null, roleMasterId: null, departmentId: null };
}

function buildSteps(steps: any[]) {
  return steps.map((step: any, index: number) => ({
    stepOrder: Number(step.stepOrder ?? index + 1),
    name: String(step.name ?? `Step ${index + 1}`).trim(),
    requirement: isOneOf(step.requirement, requirements) ? step.requirement : "ANY_ONE",
    approvers: {
      create: (Array.isArray(step.approvers) ? step.approvers : []).map(normalizeApprover)
    }
  }));
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));
  if (!isOneOf(body.requestType, requestTypes)) return apiError("申請種別が正しくありません。", 400);
  if (!String(body.name ?? "").trim()) return apiError("承認ルート名を入力してください。", 400);

  const before = await prisma.approvalRoute.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
    include: { steps: { include: { approvers: true }, orderBy: { stepOrder: "asc" } } }
  });
  if (!before) return apiError("承認ルートが見つかりません。", 404);

  const steps = Array.isArray(body.steps) ? body.steps : [];
  if (steps.length === 0) return apiError("承認ステップを1件以上設定してください。", 400);
  if (steps.some((step: any) => !Array.isArray(step.approvers) || step.approvers.length === 0)) {
    return apiError("承認者を1件以上設定してください。", 400);
  }

  const departmentId = normalizeApprovalRouteDepartmentId(body.departmentId);
  const isDefault = Boolean(body.isDefault);

  let updated;
  try {
    if (isDefault) {
      await assertDefaultApprovalRouteNotDuplicate({
        companyId: session.user.companyId,
        departmentId,
        requestType: body.requestType,
        excludeRouteId: params.id
      });
    }

    updated = await prisma.$transaction(async (tx) => {
      await tx.approvalStep.deleteMany({ where: { routeId: params.id } });
      return tx.approvalRoute.update({
        where: { id: params.id },
        data: {
          departmentId,
          requestType: body.requestType,
          name: String(body.name).trim(),
          description: body.description ? String(body.description) : null,
          isDefault,
          isActive: body.isActive !== false,
          steps: { create: buildSteps(steps) }
        },
        include: { steps: { include: { approvers: true }, orderBy: { stepOrder: "asc" } } }
      });
    });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "承認ルートの保存に失敗しました。", 400);
  }

  await logAction({
    request: req,
    userId: session.user.id,
    companyId: session.user.companyId,
    action: "UPDATE_APPROVAL_ROUTE",
    targetType: "APPROVAL_ROUTE",
    targetId: updated.id,
    before,
    after: updated,
    meta: { changedSteps: true, changedApprovers: true }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const before = await prisma.approvalRoute.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
    include: { steps: { include: { approvers: true } } }
  });
  if (!before) return apiError("承認ルートが見つかりません。", 404);

  await prisma.approvalRoute.delete({ where: { id: params.id } });

  await logAction({
    request: req,
    userId: session.user.id,
    companyId: session.user.companyId,
    action: "DELETE_APPROVAL_ROUTE",
    targetType: "APPROVAL_ROUTE",
    targetId: before.id,
    before
  });

  return NextResponse.json({ ok: true });
}
