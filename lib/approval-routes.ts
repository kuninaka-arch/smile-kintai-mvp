import type { RequestType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ApprovalRouteMatchType = "DEPARTMENT_DEFAULT" | "COMPANY_DEFAULT" | "NOT_FOUND";

export type ApprovalRouteResolution = {
  routeId: string | null;
  matchType: ApprovalRouteMatchType;
  reason: string;
  routeName: string | null;
};

export type ApprovalRouteValidation = {
  valid: boolean;
  reason?: string;
};

type ApprovalRouteKey = {
  companyId: string;
  departmentId?: string | null;
  requestType: RequestType;
};

type ValidatableApprovalRoute = {
  isActive: boolean;
  steps: {
    approvers: unknown[];
  }[];
};

const routeSelect = {
  id: true,
  name: true,
  isActive: true,
  steps: {
    select: {
      approvers: { select: { id: true } }
    },
    orderBy: { stepOrder: "asc" as const }
  }
};

export function normalizeApprovalRouteDepartmentId(departmentId: unknown) {
  return typeof departmentId === "string" && departmentId.trim() ? departmentId.trim() : null;
}

export function duplicateDefaultApprovalRouteMessage(departmentId: string | null) {
  return departmentId
    ? "この部署・申請種別の既定承認ルートは既に存在します。"
    : "この申請種別の全社既定承認ルートは既に存在します。";
}

export async function assertDefaultApprovalRouteNotDuplicate({
  companyId,
  departmentId,
  requestType,
  excludeRouteId
}: ApprovalRouteKey & { excludeRouteId?: string }) {
  const normalizedDepartmentId = normalizeApprovalRouteDepartmentId(departmentId);
  const duplicate = await prisma.approvalRoute.findFirst({
    where: {
      companyId,
      departmentId: normalizedDepartmentId,
      requestType,
      isDefault: true,
      ...(excludeRouteId ? { id: { not: excludeRouteId } } : {})
    },
    select: { id: true }
  });

  if (duplicate) {
    throw new Error(duplicateDefaultApprovalRouteMessage(normalizedDepartmentId));
  }
}

export function validateApprovalRoute(route: ValidatableApprovalRoute): ApprovalRouteValidation {
  if (!route.isActive) {
    return { valid: false, reason: "承認ルートが無効です。" };
  }

  if (route.steps.length === 0) {
    return { valid: false, reason: "承認ステップ未設定です。" };
  }

  if (route.steps.some((step) => step.approvers.length === 0)) {
    return { valid: false, reason: "承認者未設定のステップがあります。" };
  }

  return { valid: true };
}

export async function resolveApprovalRoute({
  companyId,
  departmentId,
  requestType
}: ApprovalRouteKey): Promise<ApprovalRouteResolution> {
  const normalizedDepartmentId = normalizeApprovalRouteDepartmentId(departmentId);
  let invalidReason: string | null = null;

  if (normalizedDepartmentId) {
    const departmentRoute = await prisma.approvalRoute.findFirst({
      where: {
        companyId,
        departmentId: normalizedDepartmentId,
        requestType,
        isDefault: true,
        isActive: true
      },
      select: routeSelect
    });

    if (departmentRoute) {
      const validation = validateApprovalRoute(departmentRoute);
      if (validation.valid) {
        return {
          routeId: departmentRoute.id,
          matchType: "DEPARTMENT_DEFAULT",
          reason: "部署別既定ルートを使用します。",
          routeName: departmentRoute.name
        };
      }
      invalidReason = `部署別既定ルート「${departmentRoute.name}」は使用できません。${validation.reason ?? ""}`;
    }
  }

  const companyRoute = await prisma.approvalRoute.findFirst({
    where: {
      companyId,
      departmentId: null,
      requestType,
      isDefault: true,
      isActive: true
    },
    select: routeSelect
  });

  if (companyRoute) {
    const validation = validateApprovalRoute(companyRoute);
    if (validation.valid) {
      return {
        routeId: companyRoute.id,
        matchType: "COMPANY_DEFAULT",
        reason: "全社既定ルートを使用します。",
        routeName: companyRoute.name
      };
    }
    invalidReason = invalidReason ?? `全社既定ルート「${companyRoute.name}」は使用できません。${validation.reason ?? ""}`;
  }

  return {
    routeId: null,
    matchType: "NOT_FOUND",
    reason: invalidReason ?? "有効な承認ルートが存在しません。",
    routeName: null
  };
}
