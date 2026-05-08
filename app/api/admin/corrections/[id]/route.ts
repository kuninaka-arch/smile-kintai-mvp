import { CorrectionStatus } from "@prisma/client";
import { logAction } from "@/lib/audit-log";
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
  };
};

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
            reason: permission.reason
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

async function syncAttendanceRequestStatus({
  companyId,
  correctionId,
  actorUserId,
  status
}: {
  companyId: string;
  correctionId: string;
  actorUserId: string;
  status: CorrectionStatus;
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
    const action = status === "APPROVED" ? "APPROVE" : "REJECT";
    const comment = status === "APPROVED" ? "打刻修正申請を承認" : "打刻修正申請を却下";
    const stepOrder = attendanceRequest.currentStepOrder ?? 1;

    await prisma.$transaction(async (tx) => {
      await tx.attendanceRequest.update({
        where: { id: attendanceRequest.id },
        data: {
          status: nextStatus,
          resolvedAt: new Date()
        }
      });

      await tx.approvalHistory.create({
        data: {
          companyId,
          requestId: attendanceRequest.id,
          actorUserId,
          action,
          fromStatus: "PENDING",
          toStatus: nextStatus,
          stepOrder,
          comment
        }
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

  if (approvalPermissionCheck.denial) {
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
        approvalPermissionReason: approvalPermissionCheck.denial.reason
      }
    });

    return apiError(`承認権限がありません。${approvalPermissionCheck.denial.reason}`, 403);
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
    status
  });

  await logAction({
    request: req,
    userId: session.user.id,
    companyId: session.user.companyId,
    action: status === "APPROVED" ? "APPROVE_CORRECTION" : "REJECT_CORRECTION",
    targetType: "CORRECTION",
    targetId: request.id,
    before: request,
    after: updated,
    meta: { status, ...attendanceRequestSyncMeta, ...approvalPermissionMeta }
  });

  return Response.json({ ok: true });
}
