import { NextResponse } from "next/server";
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

function routePayload(body: any, companyId: string) {
  if (!isOneOf(body.requestType, requestTypes)) {
    throw new Error("申請種別が正しくありません。");
  }

  const steps = Array.isArray(body.steps) ? body.steps : [];
  if (steps.length === 0) {
    throw new Error("承認ステップを1件以上設定してください。");
  }

  return {
    companyId,
    departmentId: body.departmentId || null,
    requestType: body.requestType,
    name: String(body.name ?? "").trim(),
    description: body.description ? String(body.description) : null,
    isDefault: Boolean(body.isDefault),
    isActive: body.isActive !== false,
    steps: {
      create: steps.map((step: any, index: number) => {
        const requirement = isOneOf(step.requirement, requirements) ? step.requirement : "ANY_ONE";
        const approvers = Array.isArray(step.approvers) ? step.approvers : [];
        if (approvers.length === 0) {
          throw new Error("承認者を1件以上設定してください。");
        }

        return {
          stepOrder: Number(step.stepOrder ?? index + 1),
          name: String(step.name ?? `Step ${index + 1}`).trim(),
          requirement,
          approvers: {
            create: approvers.map(normalizeApprover)
          }
        };
      })
    }
  };
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));

  try {
    const data = routePayload(body, session.user.companyId);
    if (!data.name) return apiError("承認ルート名を入力してください。", 400);

    const route = await prisma.approvalRoute.create({
      data,
      include: { steps: { include: { approvers: true }, orderBy: { stepOrder: "asc" } } }
    });

    await logAction({
      request: req,
      userId: session.user.id,
      companyId: session.user.companyId,
      action: "CREATE_APPROVAL_ROUTE",
      targetType: "APPROVAL_ROUTE",
      targetId: route.id,
      after: route
    });

    return NextResponse.json({ ok: true, id: route.id });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "承認ルートの保存に失敗しました。", 400);
  }
}
