import { CorrectionStatus } from "@prisma/client";
import { logAction } from "@/lib/audit-log";
import { createApprovalHistoryForDecision, resolveStepProgressDecision, type ApprovalDecision } from "@/lib/approval-engine";
import { resolveApprovalPermission } from "@/lib/approval-permissions";
import { apiError, requireAdmin, requireUnlockedDate } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

const validStatuses: CorrectionStatus[] = ["APPROVED", "REJECTED"];

type AttendanceRequestSyncMeta =
  | {
      attendanceRequestSynced: true;
      attendanceRequestId: string;
      attendanceRequestFromStatus: "PENDING";
      attendanceRequestToStatus: "APPROVED" | "REJECTED";
    }
  | {
      attendanceRequestSynced: false;
      attendanceRequestSyncSkipped: true;
      skipReason: string;
      currentStatus?: string;
    }
  | {
      attendanceRequestSynced: false;
      attendanceRequestSyncFailed: true;
      failureReason: string;
    };

type ApprovalPermissionMeta =
  | {
      approvalPermissionChecked: true;
      approvalPermissionCanApprove: boolean;
      approvalPermissionReason: string;
      approvalPermissionMatchedApproverType?: string;
      approvalPermissionRequirement?: string;
    }
  | {
      approvalPermissionChecked: false;
      approvalPermissionSkipped: true;
      approvalPermissionSkipReason: string;
    }
  | {
      approvalPermissionChecked: false;
      approvalPermissionFailed: true;
      approvalPermissionFailureReason: string;
    };

type ApprovalPermissionCheck = {
  meta: ApprovalPermissionMeta;
  denial?: {
    attendanceRequestId: string;
    reason: string;
    currentStepOrder: number | null;
  };
};

class AttendanceRequestStateChangedError extends Error {
  constructor() {
    super("既に処理済み、または状態が変更されています。");
  }
}

class DuplicateStepApprovalError extends Error {
  constructor() {
    super("このStepは既に承認済みです。");
  }
}

async function resolveApprovalPermissionMeta({
  companyId,
  correctionId,
  actorUserId
}: {
  companyId: string;
  correctionId: string;
  actorUserId: string;
}): Promise<ApprovalPermissionMeta> {
  try {
    const attendanceRequest = await prisma.attendanceRequest.findFirst({
      where: {
        companyId,
        requestType: "ATTENDANCE_CORRECTION",
        payloadJson: {
          path: ["legacyCorrectionRequestId"],
          equals: correctionId
        }
      },
      select: { id: true }
    });

    if (!attendanceRequest) {
      return {
        approvalPermissionChecked: false,
        approvalPermissionSkipped: true,
        approvalPermissionSkipReason: "対応するAttendanceRequestが見つかりません。"
      };
    }

    const permission = await resolveApprovalPermission({
      attendanceRequestId: attendanceRequest.id,
      actorUserId,
      companyId
    });

    return {
      approvalPermissionChecked: true,
      approvalPermissionCanApprove: permission.canApprove,
      approvalPermissionReason: permission.reason,
      approvalPermissionMatchedApproverType: permission.matchedApprover?.approverType,
      approvalPermissionRequirement: permission.requirement
    };
  } catch (error) {
    return {
      approvalPermissionChecked: false,
      approvalPermissionFailed: true,
      approvalPermissionFailureReason: error instanceof Error ? error.message : "承認権限判定に失敗しました。"
    };
  }
}

async function resolveApprovalPermissionCheck({
  companyId,
  correctionId,
  actorUserId
}: {
  companyId: string;
  correctionId: string;
  actorUserId: string;
}): Promise<ApprovalPermissionCheck> {
  try {
    const attendanceRequest = await prisma.attendanceRequest.findFirst({
      where: {
        companyId,
        requestType: "ATTENDANCE_CORRECTION",
        payloadJson: {
          path: ["legacyCorrectionRequestId"],
          equals: correctionId
        }
      },
      select: { id: true }
    });

    if (!attendanceRequest) {
      return {
        meta: {
          approvalPermissionChecked: false,
          approvalPermissionSkipped: true,
          approvalPermissionSkipReason: "対応するAttendanceRequestが見つかりません。"
        }
      };
    }

    const permission = await resolveApprovalPermission({
      attendanceRequestId: attendanceRequest.id,
      actorUserId,
      companyId
    });

    return {
      meta: {
        approvalPermissionChecked: true,
        approvalPermissionCanApprove: permission.canApprove,
        approvalPermissionReason: permission.reason,
        approvalPermissionMatchedApproverType: permission.matchedApprover?.approverType,
        approvalPermissionRequirement: permission.requirement
      },
      denial: permission.canApprove
        ? undefined
        : {
            attendanceRequestId: attendanceRequest.id,
            reason: permission.reason,
            currentStepOrder: permission.currentStepOrder
          }
    };
  } catch (error) {
    return {
      meta: {
        approvalPermissionChecked: false,
        approvalPermissionFailed: true,
        approvalPermissionFailureReason: error instanceof Error ? error.message : "承認権限判定に失敗しました。"
      }
    };
  }
}

async function advanceAttendanceRequestStep({
  companyId,
  attendanceRequestId,
  actorUserId,
  approvalDecision,
  currentStepOrder,
  nextStepOrder
}: {
  companyId: string;
  attendanceRequestId: string;
  actorUserId: string;
  approvalDecision: ApprovalDecision;
  currentStepOrder: number;
  nextStepOrder: number;
}) {
  await prisma.$transaction(async (tx) => {
    const updateResult = await tx.attendanceRequest.updateMany({
      where: {
        id: attendanceRequestId,
        companyId,
        status: "PENDING",
        currentStepOrder
      },
      data: { currentStepOrder: nextStepOrder }
    });

    if (updateResult.count !== 1) {
      throw new AttendanceRequestStateChangedError();
    }

    await createApprovalHistoryForDecision({
      companyId,
      actorUserId,
      decision: approvalDecision,
      client: tx
    });
  });

  return {
    attendanceRequestSynced: true,
    attendanceRequestId,
    attendanceRequestFromStatus: "PENDING",
    attendanceRequestToStatus: "PENDING",
    attendanceRequestCurrentStepOrder: currentStepOrder,
    attendanceRequestNextStepOrder: nextStepOrder
  };
}

async function recordPendingStepApproval({
  companyId,
  attendanceRequestId,
  actorUserId,
  approvalDecision,
  currentStepOrder
}: {
  companyId: string;
  attendanceRequestId: string;
  actorUserId: string;
  approvalDecision: ApprovalDecision;
  currentStepOrder: number;
}) {
  await prisma.$transaction(async (tx) => {
    const existingApproval = await tx.approvalHistory.findFirst({
      where: {
        requestId: attendanceRequestId,
        action: "APPROVE",
        actorUserId,
        stepOrder: currentStepOrder
      },
      select: { id: true }
    });

    if (existingApproval) {
      throw new DuplicateStepApprovalError();
    }

    await createApprovalHistoryForDecision({
      companyId,
      actorUserId,
      decision: approvalDecision,
      client: tx
    });
  });

  return {
    attendanceRequestSynced: true,
    attendanceRequestId,
    attendanceRequestFromStatus: "PENDING",
    attendanceRequestToStatus: "PENDING",
    attendanceRequestCurrentStepOrder: currentStepOrder,
    attendanceRequestNextStepOrder: currentStepOrder
  };
}

async function syncAttendanceRequestStatus({
  companyId,
  correctionId,
  actorUserId,
  status,
  approvalDecision
}: {
  companyId: string;
  correctionId: string;
  actorUserId: string;
  status: CorrectionStatus;
  approvalDecision: ApprovalDecision;
}): Promise<AttendanceRequestSyncMeta> {
  try {
    const attendanceRequest = await prisma.attendanceRequest.findFirst({
      where: {
        companyId,
        requestType: "ATTENDANCE_CORRECTION",
        payloadJson: {
          path: ["legacyCorrectionRequestId"],
          equals: correctionId
        }
      },
      select: { id: true, status: true, currentStepOrder: true }
    });

    if (!attendanceRequest) {
      return {
        attendanceRequestSynced: false,
        attendanceRequestSyncSkipped: true,
        skipReason: "対応するAttendanceRequestが見つかりません。"
      };
    }

    if (attendanceRequest.status !== "PENDING") {
      return {
        attendanceRequestSynced: false,
        attendanceRequestSyncSkipped: true,
        skipReason: "AttendanceRequestは既に解決済みです。",
        currentStatus: attendanceRequest.status
      };
    }

    const nextStatus = status === "APPROVED" ? "APPROVED" : "REJECTED";

    await prisma.$transaction(async (tx) => {
      await tx.attendanceRequest.update({
        where: { id: attendanceRequest.id },
        data: {
          status: nextStatus,
          resolvedAt: new Date()
        }
      });

      await createApprovalHistoryForDecision({
        companyId,
        actorUserId,
        decision: approvalDecision,
        client: tx
      });
    });

    return {
      attendanceRequestSynced: true,
      attendanceRequestId: attendanceRequest.id,
      attendanceRequestFromStatus: "PENDING",
      attendanceRequestToStatus: nextStatus
    };
  } catch (error) {
    return {
      attendanceRequestSynced: false,
      attendanceRequestSyncFailed: true,
      failureReason: error instanceof Error ? error.message : "AttendanceRequest のステータス同期に失敗しました。"
    };
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));
  const status = body.status as CorrectionStatus;
  if (!validStatuses.includes(status)) {
    return apiError("打刻修正申請の処理状態が正しくありません。", 400);
  }

  const request = await prisma.attendanceCorrectionRequest.findFirst({
    where: { id: params.id, companyId: session.user.companyId }
  });
  if (!request) return apiError("打刻修正申請が見つかりません。", 404);

  if (request.status !== "PENDING") return apiError("この申請はすでに処理済みです。", 409);

  const lockError = await requireUnlockedDate(session.user.companyId, request.targetDate, "打刻修正申請");
  if (lockError) return lockError;

  const approvalPermissionCheck = await resolveApprovalPermissionCheck({
    companyId: session.user.companyId,
    correctionId: request.id,
    actorUserId: session.user.id
  });
  const approvalPermissionMeta = approvalPermissionCheck.meta;
  const approvalDecision = await resolveStepProgressDecision({
    companyId: session.user.companyId,
    correctionId: request.id,
    actorUserId: session.user.id,
    requestedStatus: status
  });

  if (approvalPermissionCheck.denial) {
    const duplicateApproveDenied = approvalDecision.action === "DUPLICATE";

    await logAction({
      request: req,
      userId: session.user.id,
      companyId: session.user.companyId,
      action: "DENY_CORRECTION_APPROVAL_PERMISSION",
      targetType: "CORRECTION",
      targetId: request.id,
      before: request,
      meta: {
        correctionId: request.id,
        requestedStatus: status,
        attendanceRequestId: approvalPermissionCheck.denial.attendanceRequestId,
        approvalPermissionCanApprove: false,
        approvalPermissionReason: approvalPermissionCheck.denial.reason,
        ...(duplicateApproveDenied ? approvalDecision.auditMeta : {})
      }
    });

    return apiError(
      duplicateApproveDenied
        ? approvalPermissionCheck.denial.reason
        : `承認権限がありません。${approvalPermissionCheck.denial.reason}`,
      duplicateApproveDenied ? 409 : 403
    );
  }

  if (
    approvalDecision.action === "UNSUPPORTED" &&
    approvalDecision.attendanceRequestId &&
    approvalDecision.currentStepOrder !== null
  ) {
    await logAction({
      request: req,
      userId: session.user.id,
      companyId: session.user.companyId,
      action: "DENY_CORRECTION_APPROVAL_UNSUPPORTED",
      targetType: "CORRECTION",
      targetId: request.id,
      before: request,
      meta: {
        correctionId: request.id,
        requestedStatus: status,
        ...approvalDecision.auditMeta
      }
    });

    return apiError(approvalDecision.reason ?? "ALL_REQUIRED は現在 USER 承認者のみ対応しています。", 422);
  }

  if (
    approvalDecision.action === "PENDING" &&
    approvalDecision.attendanceRequestId &&
    approvalDecision.currentStepOrder != null
  ) {
    let attendanceRequestSyncMeta;
    try {
      attendanceRequestSyncMeta = await recordPendingStepApproval({
        companyId: session.user.companyId,
        attendanceRequestId: approvalDecision.attendanceRequestId,
        actorUserId: session.user.id,
        approvalDecision,
        currentStepOrder: approvalDecision.currentStepOrder
      });
    } catch (error) {
      if (error instanceof DuplicateStepApprovalError) {
        return apiError(error.message, 409);
      }
      throw error;
    }

    await logAction({
      request: req,
      userId: session.user.id,
      companyId: session.user.companyId,
      action: "APPROVE_CORRECTION",
      targetType: "CORRECTION",
      targetId: request.id,
      before: request,
      after: request,
      meta: {
        status,
        ...attendanceRequestSyncMeta,
        ...approvalPermissionMeta,
        ...approvalDecision.auditMeta
      }
    });

    return Response.json({ ok: true });
  }

  if (
    approvalDecision.action === "ADVANCE_STEP" &&
    approvalDecision.attendanceRequestId &&
    approvalDecision.currentStepOrder != null &&
    approvalDecision.nextStepOrder != null
  ) {
    let attendanceRequestSyncMeta;
    try {
      attendanceRequestSyncMeta = await advanceAttendanceRequestStep({
        companyId: session.user.companyId,
        attendanceRequestId: approvalDecision.attendanceRequestId,
        actorUserId: session.user.id,
        approvalDecision,
        currentStepOrder: approvalDecision.currentStepOrder,
        nextStepOrder: approvalDecision.nextStepOrder
      });
    } catch (error) {
      if (error instanceof AttendanceRequestStateChangedError) {
        return apiError(error.message, 409);
      }
      throw error;
    }

    await logAction({
      request: req,
      userId: session.user.id,
      companyId: session.user.companyId,
      action: "APPROVE_CORRECTION",
      targetType: "CORRECTION",
      targetId: request.id,
      before: request,
      after: request,
      meta: {
        status,
        ...attendanceRequestSyncMeta,
        ...approvalPermissionMeta,
        ...approvalDecision.auditMeta
      }
    });

    return Response.json({ ok: true });
  }

  const updated = await prisma.attendanceCorrectionRequest.update({
    where: { id: params.id },
    data: { status }
  });

  if (status === "APPROVED") {
    await prisma.attendanceLog.create({
      data: {
        companyId: request.companyId,
        userId: request.userId,
        type: request.requestedType,
        stampedAt: request.requestedAt,
        note: "打刻修正申請により追加"
      }
    });
  }

  const attendanceRequestSyncMeta = await syncAttendanceRequestStatus({
    companyId: session.user.companyId,
    correctionId: request.id,
    actorUserId: session.user.id,
    status,
    approvalDecision
  });

  const approvalStepMeta = approvalDecision.auditMeta;

  await logAction({
    request: req,
    userId: session.user.id,
    companyId: session.user.companyId,
    action: status === "APPROVED" ? "APPROVE_CORRECTION" : "REJECT_CORRECTION",
    targetType: "CORRECTION",
    targetId: request.id,
    before: request,
    after: updated,
    meta: { status, ...attendanceRequestSyncMeta, ...approvalPermissionMeta, ...approvalStepMeta }
  });

  return Response.json({ ok: true });
}
