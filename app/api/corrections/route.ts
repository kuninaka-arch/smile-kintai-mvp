import { AttendanceType } from "@prisma/client";
import { logAction } from "@/lib/audit-log";
import { resolveApprovalRoute } from "@/lib/approval-routes";
import { apiError, requireCompanyUser, requireUnlockedDate } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

const validTypes: AttendanceType[] = ["CLOCK_IN", "CLOCK_OUT", "BREAK_START", "BREAK_END"];

function tokyoDate(date: string) {
  return new Date(`${date}T00:00:00+09:00`);
}

function tokyoDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00+09:00`);
}

export async function POST(req: Request) {
  const auth = await requireCompanyUser();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));
  const targetDateText = String(body.targetDate ?? "");
  const requestedTimeText = String(body.requestedTime ?? "");
  const requestedType = body.requestedType as AttendanceType;

  if (!targetDateText || !requestedTimeText || !validTypes.includes(requestedType)) {
    return apiError("申請内容が正しくありません。", 400);
  }

  const targetDate = tokyoDate(targetDateText);
  const requestedAt = tokyoDateTime(targetDateText, requestedTimeText);
  if (Number.isNaN(targetDate.getTime()) || Number.isNaN(requestedAt.getTime())) {
    return apiError("対象日時が正しくありません。", 400);
  }

  const lockError = await requireUnlockedDate(session.user.companyId, targetDate, "打刻修正申請");
  if (lockError) return lockError;

  let departmentId: string | null = null;
  let routeResolution:
    | Awaited<ReturnType<typeof resolveApprovalRoute>>
    | {
        routeId: null;
        matchType: "NOT_FOUND";
        reason: string;
        routeName: null;
      };

  try {
    const user = await prisma.user.findFirst({
      where: { id: session.user.id, companyId: session.user.companyId },
      select: { departmentId: true }
    });
    departmentId = user?.departmentId ?? null;
    routeResolution = await resolveApprovalRoute({
      companyId: session.user.companyId,
      departmentId,
      requestType: "ATTENDANCE_CORRECTION"
    });
  } catch (error) {
    routeResolution = {
      routeId: null,
      matchType: "NOT_FOUND",
      reason: error instanceof Error ? error.message : "承認ルートの解決に失敗しました。",
      routeName: null
    };
  }

  const correction = await prisma.attendanceCorrectionRequest.create({
    data: {
      companyId: session.user.companyId,
      userId: session.user.id,
      targetDate,
      requestedAt,
      requestedType,
      reason: String(body.reason ?? "")
    }
  });

  let attendanceRequestMeta:
    | {
        attendanceRequestCreated: true;
        attendanceRequestId: string;
        approvalRouteId: string;
        approvalRouteMatchType: string;
      }
    | {
        attendanceRequestCreated: false;
        attendanceRequestSkipped: true;
        skipReason: string;
      }
    | {
        attendanceRequestCreated: false;
        attendanceRequestFailed: true;
        failureReason: string;
      };

  if (routeResolution.routeId) {
    try {
      const attendanceRequest = await prisma.$transaction(async (tx) => {
        const request = await tx.attendanceRequest.create({
          data: {
            companyId: session.user.companyId,
            userId: session.user.id,
            requestType: "ATTENDANCE_CORRECTION",
            status: "PENDING",
            title: "打刻修正申請",
            targetDate,
            payloadJson: {
              source: "AttendanceCorrectionRequest",
              legacyCorrectionRequestId: correction.id,
              requestedType,
              requestedAt: requestedAt.toISOString(),
              requestedTimeText,
              reason: String(body.reason ?? ""),
              departmentId,
              approvalRouteId: routeResolution.routeId,
              approvalRouteMatchType: routeResolution.matchType,
              approvalRouteName: routeResolution.routeName
            },
            currentStepOrder: 1,
            submittedAt: new Date()
          }
        });

        await tx.approvalHistory.create({
          data: {
            companyId: session.user.companyId,
            requestId: request.id,
            actorUserId: session.user.id,
            action: "SUBMIT",
            fromStatus: "DRAFT",
            toStatus: "PENDING",
            stepOrder: 1,
            comment: "打刻修正申請を提出"
          }
        });

        return request;
      });

      attendanceRequestMeta = {
        attendanceRequestCreated: true,
        attendanceRequestId: attendanceRequest.id,
        approvalRouteId: routeResolution.routeId,
        approvalRouteMatchType: routeResolution.matchType
      };
    } catch (error) {
      attendanceRequestMeta = {
        attendanceRequestCreated: false,
        attendanceRequestFailed: true,
        failureReason: error instanceof Error ? error.message : "AttendanceRequest の併記録に失敗しました。"
      };
    }
  } else {
    attendanceRequestMeta = {
      attendanceRequestCreated: false,
      attendanceRequestSkipped: true,
      skipReason: routeResolution.reason
    };
  }

  await logAction({
    request: req,
    userId: session.user.id,
    companyId: session.user.companyId,
    action: "CREATE_CORRECTION",
    targetType: "CORRECTION",
    targetId: correction.id,
    after: correction,
    meta: { targetDate: targetDateText, requestedTime: requestedTimeText, ...attendanceRequestMeta }
  });

  return Response.json({ ok: true });
}
