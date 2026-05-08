import type { ApprovalAction, CorrectionStatus, Prisma, RequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ApprovalDecisionAction =
  | "PENDING"
  | "ADVANCE_STEP"
  | "FINAL_APPROVE"
  | "FINAL_REJECT"
  | "DENY"
  | "UNSUPPORTED"
  | "DUPLICATE";

export type ApprovalDecision = {
  ok: boolean;
  statusCode?: number;
  reason?: string;
  action: ApprovalDecisionAction;
  attendanceRequestId?: string | null;
  currentStepOrder?: number | null;
  nextStepOrder?: number | null;
  requirement?: "ANY_ONE" | "ALL_REQUIRED" | null;
  auditMeta: Record<string, unknown>;
};

export type StepProgressDecisionRequestAction = "APPROVE" | "REJECT";

type ApprovalHistoryCreateClient = {
  approvalHistory: {
    create: (args: Prisma.ApprovalHistoryCreateArgs) => Promise<unknown>;
  };
};

const APPROVAL_HISTORY_APPROVE_COMMENT = "承認ステップを承認";
const APPROVAL_HISTORY_REJECT_COMMENT = "承認ステップを却下";

function approvalHistoryActionForDecision(action: ApprovalDecisionAction): ApprovalAction | null {
  if (action === "FINAL_REJECT") return "REJECT";
  if (action === "PENDING" || action === "ADVANCE_STEP" || action === "FINAL_APPROVE") return "APPROVE";
  return null;
}

function approvalHistoryToStatusForDecision(action: ApprovalDecisionAction): RequestStatus | null {
  if (action === "FINAL_REJECT") return "REJECTED";
  if (action === "FINAL_APPROVE") return "APPROVED";
  if (action === "PENDING" || action === "ADVANCE_STEP") return "PENDING";
  return null;
}

export async function createApprovalHistoryForDecision({
  companyId,
  actorUserId,
  decision,
  client = prisma
}: {
  companyId: string;
  actorUserId: string;
  decision: ApprovalDecision;
  client?: ApprovalHistoryCreateClient;
}) {
  const action = approvalHistoryActionForDecision(decision.action);
  const toStatus = approvalHistoryToStatusForDecision(decision.action);

  if (!action || !toStatus || !decision.attendanceRequestId || decision.currentStepOrder == null) {
    return null;
  }

  return client.approvalHistory.create({
    data: {
      companyId,
      requestId: decision.attendanceRequestId,
      actorUserId,
      action,
      fromStatus: "PENDING",
      toStatus,
      stepOrder: decision.currentStepOrder,
      comment: action === "APPROVE" ? APPROVAL_HISTORY_APPROVE_COMMENT : APPROVAL_HISTORY_REJECT_COMMENT
    }
  });
}

function payloadObject(payloadJson: unknown) {
  return payloadJson && typeof payloadJson === "object" && !Array.isArray(payloadJson)
    ? (payloadJson as Record<string, unknown>)
    : {};
}

function payloadString(payloadJson: unknown, key: string) {
  const value = payloadObject(payloadJson)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function uniqueStrings(values: (string | null | undefined)[]) {
  return Array.from(
    new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0))
  );
}

function missingAttendanceRequestDecision(attendanceRequestId: string): ApprovalDecision {
  return {
    ok: false,
    statusCode: 404,
    reason: "申請が見つかりません。",
    action: "DENY",
    attendanceRequestId,
    currentStepOrder: null,
    nextStepOrder: null,
    requirement: null,
    auditMeta: {
      attendanceRequestId,
      approvalDecisionDenied: true,
      approvalDecisionDenyReason: "AttendanceRequest not found."
    }
  };
}

function duplicateApprovalDecision({
  attendanceRequestId,
  actorUserId,
  currentStepOrder,
  nextStepOrder,
  requirement
}: {
  attendanceRequestId: string;
  actorUserId: string;
  currentStepOrder: number;
  nextStepOrder: number | null;
  requirement: "ANY_ONE" | "ALL_REQUIRED";
}): ApprovalDecision {
  return {
    ok: false,
    statusCode: 409,
    reason: "このStepは既に承認済みです。",
    action: "DUPLICATE",
    attendanceRequestId,
    currentStepOrder,
    nextStepOrder,
    requirement,
    auditMeta: {
      approvalDuplicateApproveDenied: true,
      approvalCurrentStepOrder: currentStepOrder,
      approvalActorUserId: actorUserId
    }
  };
}

function unsupportedAllRequiredDecision({
  attendanceRequestId,
  currentStepOrder,
  nextStepOrder,
  requirement,
  unsupportedApproverType
}: {
  attendanceRequestId: string;
  currentStepOrder: number;
  nextStepOrder: number | null;
  requirement: "ALL_REQUIRED";
  unsupportedApproverType?: string | null;
}): ApprovalDecision {
  const unsupportedReason = "ALL_REQUIRED currently supports USER approvers only.";

  return {
    ok: false,
    statusCode: 422,
    reason: "ALL_REQUIRED は現在 USER 承認者のみ対応しています。",
    action: "UNSUPPORTED",
    attendanceRequestId,
    currentStepOrder,
    nextStepOrder,
    requirement,
    auditMeta: {
      attendanceRequestId,
      approvalUnsupportedRequirement: "ALL_REQUIRED",
      approvalUnsupportedReason: unsupportedReason,
      approvalCurrentStepOrder: currentStepOrder,
      approvalUnsupportedApproverType: unsupportedApproverType ?? null
    }
  };
}

export async function resolveStepProgressDecisionForAttendanceRequest({
  companyId,
  attendanceRequestId,
  actorUserId,
  action
}: {
  companyId: string;
  attendanceRequestId: string;
  actorUserId: string;
  action: StepProgressDecisionRequestAction;
}): Promise<ApprovalDecision> {
  const attendanceRequest = await prisma.attendanceRequest.findFirst({
    where: {
      id: attendanceRequestId,
      companyId
    },
    select: {
      id: true,
      requestType: true,
      status: true,
      currentStepOrder: true,
      payloadJson: true,
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
    return missingAttendanceRequestDecision(attendanceRequestId);
  }

  const currentStepOrder = attendanceRequest.currentStepOrder ?? 1;

  if (attendanceRequest.status !== "PENDING") {
    return {
      ok: false,
      statusCode: 409,
      reason: "この申請は処理待ちではありません。",
      action: "DENY",
      attendanceRequestId: attendanceRequest.id,
      currentStepOrder,
      nextStepOrder: null,
      requirement: null,
      auditMeta: {
        attendanceRequestId: attendanceRequest.id,
        approvalDecisionDenied: true,
        approvalDecisionDenyReason: "AttendanceRequest is not pending.",
        approvalCurrentStepOrder: currentStepOrder,
        attendanceRequestStatus: attendanceRequest.status
      }
    };
  }

  const approvalRouteId = payloadString(attendanceRequest.payloadJson, "approvalRouteId");

  if (!approvalRouteId) {
    return {
      ok: false,
      statusCode: 422,
      reason: "承認ルート情報が見つかりません。",
      action: "UNSUPPORTED",
      attendanceRequestId: attendanceRequest.id,
      currentStepOrder,
      nextStepOrder: null,
      requirement: null,
      auditMeta: {
        attendanceRequestId: attendanceRequest.id,
        approvalUnsupportedReason: "Approval route id is missing.",
        approvalCurrentStepOrder: currentStepOrder
      }
    };
  }

  const approvalRoute = await prisma.approvalRoute.findFirst({
    where: { id: approvalRouteId, companyId, isActive: true },
    select: {
      steps: {
        select: {
          stepOrder: true,
          requirement: true,
          approvers: {
            select: {
              id: true,
              approverType: true,
              userId: true
            }
          }
        },
        orderBy: { stepOrder: "asc" }
      }
    }
  });

  const currentStep = approvalRoute?.steps.find((step) => step.stepOrder === currentStepOrder) ?? null;
  if (!currentStep) {
    return {
      ok: false,
      statusCode: 422,
      reason: "現在の承認ステップが見つかりません。",
      action: "UNSUPPORTED",
      attendanceRequestId: attendanceRequest.id,
      currentStepOrder,
      nextStepOrder: null,
      requirement: null,
      auditMeta: {
        attendanceRequestId: attendanceRequest.id,
        approvalUnsupportedReason: "Current approval step is missing.",
        approvalCurrentStepOrder: currentStepOrder,
        approvalRouteId
      }
    };
  }

  const nextStep = approvalRoute?.steps.find((step) => step.stepOrder > currentStepOrder) ?? null;
  const nextStepOrder = nextStep?.stepOrder ?? null;
  const requirement = currentStep.requirement;
  const approvedUserIdsBeforeAction = uniqueStrings(
    attendanceRequest.approvalHistories
      .filter((history) => history.action === "APPROVE" && history.stepOrder === currentStepOrder)
      .map((history) => history.actorUserId)
  );

  if (action === "REJECT") {
    return {
      ok: true,
      action: "FINAL_REJECT",
      attendanceRequestId: attendanceRequest.id,
      currentStepOrder,
      nextStepOrder,
      requirement,
      auditMeta: {
        approvalStepAdvanced: false,
        approvalCurrentStepOrder: currentStepOrder,
        approvalNextStepOrder: nextStepOrder,
        approvalRejectedAtStepOrder: currentStepOrder,
        approvalFinalRejected: true,
        approvalRequirement: requirement
      }
    };
  }

  if (approvedUserIdsBeforeAction.includes(actorUserId)) {
    return duplicateApprovalDecision({
      attendanceRequestId: attendanceRequest.id,
      actorUserId,
      currentStepOrder,
      nextStepOrder,
      requirement
    });
  }

  if (requirement === "ANY_ONE") {
    return {
      ok: true,
      action: nextStepOrder === null ? "FINAL_APPROVE" : "ADVANCE_STEP",
      attendanceRequestId: attendanceRequest.id,
      currentStepOrder,
      nextStepOrder,
      requirement,
      auditMeta: {
        approvalStepAdvanced: nextStepOrder !== null,
        approvalCurrentStepOrder: currentStepOrder,
        approvalNextStepOrder: nextStepOrder,
        approvalFinalApproved: nextStepOrder === null,
        approvalRequirement: requirement
      }
    };
  }

  const unsupportedApprover = currentStep.approvers.find(
    (approver) => approver.approverType !== "USER" || !approver.userId
  );
  const requiredUserIds = uniqueStrings(currentStep.approvers.map((approver) => approver.userId));

  if (unsupportedApprover || requiredUserIds.length === 0) {
    return unsupportedAllRequiredDecision({
      attendanceRequestId: attendanceRequest.id,
      currentStepOrder,
      nextStepOrder,
      requirement,
      unsupportedApproverType: unsupportedApprover?.approverType
    });
  }

  const approvedUserIds = uniqueStrings([...approvedUserIdsBeforeAction, actorUserId]);
  const remainingUserIds = requiredUserIds.filter((userId) => !approvedUserIds.includes(userId));
  const allRequiredMeta = {
    approvalRequirement: requirement,
    approvalAllRequiredCompleted: remainingUserIds.length === 0,
    approvalCurrentStepOrder: currentStepOrder,
    approvalNextStepOrder: nextStepOrder,
    approvalRequiredUserIds: requiredUserIds,
    approvalApprovedUserIds: approvedUserIds,
    approvalRemainingUserIds: remainingUserIds
  };

  if (remainingUserIds.length > 0) {
    return {
      ok: true,
      action: "PENDING",
      attendanceRequestId: attendanceRequest.id,
      currentStepOrder,
      nextStepOrder,
      requirement,
      auditMeta: {
        ...allRequiredMeta,
        approvalStepAdvanced: false,
        approvalFinalApproved: false
      }
    };
  }

  return {
    ok: true,
    action: nextStepOrder === null ? "FINAL_APPROVE" : "ADVANCE_STEP",
    attendanceRequestId: attendanceRequest.id,
    currentStepOrder,
    nextStepOrder,
    requirement,
    auditMeta: {
      ...allRequiredMeta,
      approvalStepAdvanced: nextStepOrder !== null,
      approvalFinalApproved: nextStepOrder === null
    }
  };
}

export async function resolveStepProgressDecision({
  companyId,
  correctionId,
  actorUserId,
  requestedStatus
}: {
  companyId: string;
  correctionId: string;
  actorUserId: string;
  requestedStatus: CorrectionStatus;
}): Promise<ApprovalDecision> {
  const attendanceRequest = await prisma.attendanceRequest.findFirst({
    where: {
      companyId,
      requestType: "ATTENDANCE_CORRECTION",
      payloadJson: {
        path: ["legacyCorrectionRequestId"],
        equals: correctionId
      }
    },
    select: {
      id: true,
      currentStepOrder: true,
      payloadJson: true,
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
    return {
      ok: true,
      action: requestedStatus === "REJECTED" ? "FINAL_REJECT" : "FINAL_APPROVE",
      attendanceRequestId: null,
      currentStepOrder: null,
      nextStepOrder: null,
      requirement: null,
      auditMeta: {}
    };
  }

  const currentStepOrder = attendanceRequest.currentStepOrder ?? 1;
  const approvalRouteId = payloadString(attendanceRequest.payloadJson, "approvalRouteId");

  if (!approvalRouteId) {
    return {
      ok: true,
      action: requestedStatus === "REJECTED" ? "FINAL_REJECT" : "FINAL_APPROVE",
      attendanceRequestId: attendanceRequest.id,
      currentStepOrder,
      nextStepOrder: null,
      requirement: null,
      auditMeta: {
        approvalStepProgressSkipped: true,
        approvalStepProgressSkipReason: "承認ルート情報が見つかりません。"
      }
    };
  }

  const approvalRoute = await prisma.approvalRoute.findFirst({
    where: { id: approvalRouteId, companyId, isActive: true },
    select: {
      steps: {
        select: {
          stepOrder: true,
          requirement: true,
          approvers: {
            select: {
              id: true,
              approverType: true,
              userId: true
            }
          }
        },
        orderBy: { stepOrder: "asc" }
      }
    }
  });

  const currentStep = approvalRoute?.steps.find((step) => step.stepOrder === currentStepOrder) ?? null;
  if (!currentStep) {
    return {
      ok: true,
      action: requestedStatus === "REJECTED" ? "FINAL_REJECT" : "FINAL_APPROVE",
      attendanceRequestId: attendanceRequest.id,
      currentStepOrder,
      nextStepOrder: null,
      requirement: null,
      auditMeta: {
        approvalStepProgressSkipped: true,
        approvalStepProgressSkipReason: "現在の承認ステップが見つかりません。"
      }
    };
  }

  const nextStep = approvalRoute?.steps.find((step) => step.stepOrder > currentStepOrder) ?? null;
  const nextStepOrder = nextStep?.stepOrder ?? null;
  const requirement = currentStep.requirement;
  const approvedUserIdsBeforeAction = uniqueStrings(
    attendanceRequest.approvalHistories
      .filter((history) => history.action === "APPROVE" && history.stepOrder === currentStepOrder)
      .map((history) => history.actorUserId)
  );

  if (requestedStatus === "REJECTED") {
    return {
      ok: true,
      action: "FINAL_REJECT",
      attendanceRequestId: attendanceRequest.id,
      currentStepOrder,
      nextStepOrder,
      requirement,
      auditMeta: {
        approvalStepAdvanced: false,
        approvalCurrentStepOrder: currentStepOrder,
        approvalNextStepOrder: nextStepOrder,
        approvalRejectedAtStepOrder: currentStepOrder,
        approvalFinalRejected: true,
        approvalRequirement: requirement
      }
    };
  }

  if (approvedUserIdsBeforeAction.includes(actorUserId)) {
    return duplicateApprovalDecision({
      attendanceRequestId: attendanceRequest.id,
      actorUserId,
      currentStepOrder,
      nextStepOrder,
      requirement
    });
  }

  if (requirement === "ANY_ONE") {
    return {
      ok: true,
      action: nextStepOrder === null ? "FINAL_APPROVE" : "ADVANCE_STEP",
      attendanceRequestId: attendanceRequest.id,
      currentStepOrder,
      nextStepOrder,
      requirement,
      auditMeta: {
        approvalStepAdvanced: nextStepOrder !== null,
        approvalCurrentStepOrder: currentStepOrder,
        approvalNextStepOrder: nextStepOrder,
        approvalFinalApproved: nextStepOrder === null,
        approvalRequirement: requirement
      }
    };
  }

  const unsupportedApprover = currentStep.approvers.find(
    (approver) => approver.approverType !== "USER" || !approver.userId
  );
  const requiredUserIds = uniqueStrings(currentStep.approvers.map((approver) => approver.userId));

  if (unsupportedApprover || requiredUserIds.length === 0) {
    return unsupportedAllRequiredDecision({
      attendanceRequestId: attendanceRequest.id,
      currentStepOrder,
      nextStepOrder,
      requirement,
      unsupportedApproverType: unsupportedApprover?.approverType
    });
  }

  const approvedUserIds = uniqueStrings([...approvedUserIdsBeforeAction, actorUserId]);
  const remainingUserIds = requiredUserIds.filter((userId) => !approvedUserIds.includes(userId));
  const allRequiredMeta = {
    approvalRequirement: requirement,
    approvalAllRequiredCompleted: remainingUserIds.length === 0,
    approvalCurrentStepOrder: currentStepOrder,
    approvalNextStepOrder: nextStepOrder,
    approvalRequiredUserIds: requiredUserIds,
    approvalApprovedUserIds: approvedUserIds,
    approvalRemainingUserIds: remainingUserIds
  };

  if (remainingUserIds.length > 0) {
    return {
      ok: true,
      action: "PENDING",
      attendanceRequestId: attendanceRequest.id,
      currentStepOrder,
      nextStepOrder,
      requirement,
      auditMeta: {
        ...allRequiredMeta,
        approvalStepAdvanced: false,
        approvalFinalApproved: false
      }
    };
  }

  return {
    ok: true,
    action: nextStepOrder === null ? "FINAL_APPROVE" : "ADVANCE_STEP",
    attendanceRequestId: attendanceRequest.id,
    currentStepOrder,
    nextStepOrder,
    requirement,
    auditMeta: {
      ...allRequiredMeta,
      approvalStepAdvanced: nextStepOrder !== null,
      approvalFinalApproved: nextStepOrder === null
    }
  };
}
