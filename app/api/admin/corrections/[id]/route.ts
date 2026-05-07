import { CorrectionStatus } from "@prisma/client";
import { logAction } from "@/lib/audit-log";
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
    meta: { status, ...attendanceRequestSyncMeta }
  });

  return Response.json({ ok: true });
}
