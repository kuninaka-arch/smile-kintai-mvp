import type { ApprovalApproverType, ApprovalRequirement, RequestStatus, RequestType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ResolveApprovalPermissionInput = {
  attendanceRequestId: string;
  actorUserId: string;
  companyId: string;
};

export type ResolvedApprovalPermission = {
  canApprove: boolean;
  reason: string;
  requestStatus: string | null;
  currentStepOrder: number | null;
  matchedApprover?: {
    approverType: string;
    approverId?: string;
    delegatedFromUserId?: string;
  };
  requirement?: string;
  stepCompleteAfterThisAction?: boolean;
};

type PayloadObject = Record<string, unknown>;

type ApprovalStepWithApprovers = {
  id: string;
  stepOrder: number;
  requirement: ApprovalRequirement;
  approvers: {
    id: string;
    approverType: ApprovalApproverType;
    userId: string | null;
    roleMasterId: string | null;
    departmentId: string | null;
  }[];
};

function deny({
  reason,
  requestStatus,
  currentStepOrder,
  requirement
}: {
  reason: string;
  requestStatus: RequestStatus | string | null;
  currentStepOrder: number | null;
  requirement?: ApprovalRequirement | string;
}): ResolvedApprovalPermission {
  return {
    canApprove: false,
    reason,
    requestStatus,
    currentStepOrder,
    ...(requirement ? { requirement } : {})
  };
}

function payloadObject(payloadJson: unknown): PayloadObject {
  return payloadJson && typeof payloadJson === "object" && !Array.isArray(payloadJson)
    ? (payloadJson as PayloadObject)
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getApprovalRouteId(payloadJson: unknown): string | null {
  return stringValue(payloadObject(payloadJson).approvalRouteId);
}

function getPayloadDepartmentId(payloadJson: unknown): string | null {
  return stringValue(payloadObject(payloadJson).departmentId);
}

function departmentMatchesScope({
  scope,
  permissionDepartmentId,
  actorDepartmentId,
  targetDepartmentId
}: {
  scope: string;
  permissionDepartmentId: string | null;
  actorDepartmentId: string | null;
  targetDepartmentId: string | null;
}) {
  if (scope === "ALL_COMPANY") return true;
  if (!targetDepartmentId) return false;
  if (scope === "OWN_DEPARTMENT") return !!actorDepartmentId && actorDepartmentId === targetDepartmentId;
  if (scope === "SELECTED_DEPARTMENTS") return !!permissionDepartmentId && permissionDepartmentId === targetDepartmentId;
  return false;
}

async function hasDepartmentManagerPermission({
  actorUserId,
  companyId,
  actorDepartmentId,
  targetDepartmentId
}: {
  actorUserId: string;
  companyId: string;
  actorDepartmentId: string | null;
  targetDepartmentId: string | null;
}) {
  const permissions = await prisma.userDepartmentPermission.findMany({
    where: {
      userId: actorUserId,
      companyId,
      canApprove: true
    },
    select: {
      scope: true,
      departmentId: true
    }
  });

  return permissions.some((permission) =>
    departmentMatchesScope({
      scope: permission.scope,
      permissionDepartmentId: permission.departmentId,
      actorDepartmentId,
      targetDepartmentId
    })
  );
}

async function findActiveDelegate({
  companyId,
  fromUserId,
  toUserId,
  requestType,
  now
}: {
  companyId: string;
  fromUserId: string;
  toUserId: string;
  requestType: RequestType;
  now: Date;
}) {
  return prisma.approvalDelegate.findFirst({
    where: {
      companyId,
      fromUserId,
      toUserId,
      isActive: true,
      startsAt: { lte: now },
      endsAt: { gte: now },
      OR: [{ requestType }, { requestType: null }]
    },
    select: { fromUserId: true }
  });
}

async function matchApprover({
  approver,
  actor,
  attendanceRequest,
  companyId,
  targetDepartmentId,
  now
}: {
  approver: ApprovalStepWithApprovers["approvers"][number];
  actor: {
    id: string;
    role: string;
    roleMasterId: string | null;
    departmentId: string | null;
  };
  attendanceRequest: {
    requestType: RequestType;
  };
  companyId: string;
  targetDepartmentId: string | null;
  now: Date;
}): Promise<ResolvedApprovalPermission["matchedApprover"] | null> {
  if (approver.approverType === "USER") {
    if (approver.userId === actor.id) {
      return { approverType: approver.approverType, approverId: approver.userId };
    }

    if (approver.userId) {
      const delegate = await findActiveDelegate({
        companyId,
        fromUserId: approver.userId,
        toUserId: actor.id,
        requestType: attendanceRequest.requestType,
        now
      });
      if (delegate) {
        return {
          approverType: approver.approverType,
          approverId: approver.userId,
          delegatedFromUserId: delegate.fromUserId
        };
      }
    }

    return null;
  }

  if (approver.approverType === "ROLE") {
    return approver.roleMasterId && approver.roleMasterId === actor.roleMasterId
      ? { approverType: approver.approverType, approverId: approver.roleMasterId }
      : null;
  }

  if (approver.approverType === "COMPANY_ADMIN") {
    return actor.role === "ADMIN" ? { approverType: approver.approverType } : null;
  }

  if (approver.approverType === "DEPARTMENT_MANAGER") {
    const allowed = await hasDepartmentManagerPermission({
      actorUserId: actor.id,
      companyId,
      actorDepartmentId: actor.departmentId,
      targetDepartmentId
    });
    return allowed ? { approverType: approver.approverType, approverId: targetDepartmentId ?? undefined } : null;
  }

  return null;
}

export async function resolveApprovalPermission({
  attendanceRequestId,
  actorUserId,
  companyId
}: ResolveApprovalPermissionInput): Promise<ResolvedApprovalPermission> {
  const attendanceRequest = await prisma.attendanceRequest.findFirst({
    where: {
      id: attendanceRequestId,
      companyId
    },
    include: {
      user: {
        select: {
          id: true,
          departmentId: true
        }
      },
      approvalHistories: {
        select: {
          action: true,
          actorUserId: true,
          stepOrder: true
        }
      }
    }
  });

  if (!attendanceRequest) {
    return deny({
      reason: "申請が見つかりません。",
      requestStatus: null,
      currentStepOrder: null
    });
  }

  const currentStepOrder = attendanceRequest.currentStepOrder ?? 1;

  if (attendanceRequest.status !== "PENDING") {
    return deny({
      reason: "この申請は処理待ちではありません。",
      requestStatus: attendanceRequest.status,
      currentStepOrder
    });
  }

  const alreadyApproved = attendanceRequest.approvalHistories.some(
    (history) =>
      history.action === "APPROVE" &&
      history.actorUserId === actorUserId &&
      history.stepOrder === currentStepOrder
  );

  if (alreadyApproved) {
    return deny({
      reason: "このステップはすでに承認済みです。",
      requestStatus: attendanceRequest.status,
      currentStepOrder
    });
  }

  const approvalRouteId = getApprovalRouteId(attendanceRequest.payloadJson);
  if (!approvalRouteId) {
    return deny({
      reason: "承認ルート情報が見つかりません。",
      requestStatus: attendanceRequest.status,
      currentStepOrder
    });
  }

  const approvalRoute = await prisma.approvalRoute.findFirst({
    where: {
      id: approvalRouteId,
      companyId,
      isActive: true
    },
    include: {
      steps: {
        include: {
          approvers: true
        },
        orderBy: { stepOrder: "asc" }
      }
    }
  });

  if (!approvalRoute) {
    return deny({
      reason: "有効な承認ルートが見つかりません。",
      requestStatus: attendanceRequest.status,
      currentStepOrder
    });
  }

  const currentStep = approvalRoute.steps.find((step) => step.stepOrder === currentStepOrder);
  if (!currentStep) {
    return deny({
      reason: "現在の承認ステップが見つかりません。",
      requestStatus: attendanceRequest.status,
      currentStepOrder
    });
  }

  const actor = await prisma.user.findFirst({
    where: {
      id: actorUserId,
      companyId
    },
    select: {
      id: true,
      role: true,
      roleMasterId: true,
      departmentId: true
    }
  });

  if (!actor) {
    return deny({
      reason: "承認者ユーザーが見つかりません。",
      requestStatus: attendanceRequest.status,
      currentStepOrder,
      requirement: currentStep.requirement
    });
  }

  const targetDepartmentId = getPayloadDepartmentId(attendanceRequest.payloadJson) ?? attendanceRequest.user.departmentId;
  const now = new Date();

  for (const approver of currentStep.approvers) {
    const matchedApprover = await matchApprover({
      approver,
      actor,
      attendanceRequest,
      companyId,
      targetDepartmentId,
      now
    });

    if (matchedApprover) {
      return {
        canApprove: true,
        reason: "承認可能です。",
        requestStatus: attendanceRequest.status,
        currentStepOrder,
        matchedApprover,
        requirement: currentStep.requirement,
        stepCompleteAfterThisAction: false
      };
    }
  }

  return deny({
    reason: "現在のステップの承認者に該当しません。",
    requestStatus: attendanceRequest.status,
    currentStepOrder,
    requirement: currentStep.requirement
  });
}


