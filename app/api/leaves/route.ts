import { LeaveRequestUnit, type RequestType } from "@prisma/client";
import { logAction } from "@/lib/audit-log";
import { resolveApprovalRoute } from "@/lib/approval-routes";
import { apiError, requireCompanyUser, requireUnlockedDate } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

function tokyoDate(date: string) {
  return new Date(`${date}T00:00:00+09:00`);
}

function resolveLeaveRequestType(code: string, name: string): RequestType | null {
  const text = `${code} ${name}`.toUpperCase();
  if (/PAID|YU|有休|有給/.test(text)) return "PAID_LEAVE";
  if (/COMP|SUBSTITUTE|代休/.test(text)) return "SUBSTITUTE_LEAVE";
  return null;
}

export async function POST(req: Request) {
  const auth = await requireCompanyUser();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));
  const targetDateText = String(body.targetDate ?? "");
  const targetDate = tokyoDate(targetDateText);
  if (!targetDateText || Number.isNaN(targetDate.getTime())) {
    return apiError("対象日が正しくありません。", 400);
  }

  const lockError = await requireUnlockedDate(session.user.companyId, targetDate, "休暇申請");
  if (lockError) return lockError;

  const leaveType = await prisma.leaveTypeMaster.findFirst({
    where: { id: body.leaveTypeId, companyId: session.user.companyId, isActive: true }
  });
  if (!leaveType) return apiError("休暇種別が見つかりません。", 400);

  const unit = body.unit === "HOUR" ? LeaveRequestUnit.HOUR : LeaveRequestUnit.FULL_DAY;
  if (unit === LeaveRequestUnit.HOUR && !leaveType.allowHourly) {
    return apiError("この休暇種別は時間単位で申請できません。", 400);
  }

  const hours = unit === LeaveRequestUnit.HOUR ? Number(body.hours ?? 0) : null;
  if (unit === LeaveRequestUnit.HOUR && (!hours || hours <= 0)) {
    return apiError("時間数を入力してください。", 400);
  }

  const reason = String(body.reason ?? "");
  const user = await prisma.user.findFirst({
    where: { id: session.user.id, companyId: session.user.companyId },
    select: { departmentId: true }
  });
  const departmentId = user?.departmentId ?? null;
  const attendanceRequestType = resolveLeaveRequestType(leaveType.code, leaveType.name);
  let attendanceRequestMeta:
    | {
        attendanceRequestCreated: true;
        attendanceRequestId: string;
        attendanceRequestType: RequestType;
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
      } = {
        attendanceRequestCreated: false,
        attendanceRequestSkipped: true,
        skipReason: "Unsupported leave type"
      };

  if (!attendanceRequestType) {
    attendanceRequestMeta = {
      attendanceRequestCreated: false,
      attendanceRequestSkipped: true,
      skipReason: "Unsupported leave type"
    };
  }

  const routeResolution = attendanceRequestType
    ? await resolveApprovalRoute({
        companyId: session.user.companyId,
        departmentId,
        requestType: attendanceRequestType
      })
    : null;

  if (attendanceRequestType && !routeResolution?.routeId) {
    attendanceRequestMeta = {
      attendanceRequestCreated: false,
      attendanceRequestSkipped: true,
      skipReason: "Approval route not found"
    };
  }

  let leave;

  if (attendanceRequestType && routeResolution?.routeId) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const createdLeave = await tx.leaveRequest.create({
          data: {
            companyId: session.user.companyId,
            userId: session.user.id,
            leaveTypeId: leaveType.id,
            targetDate,
            unit,
            hours,
            reason
          }
        });

        const attendanceRequest = await tx.attendanceRequest.create({
          data: {
            companyId: session.user.companyId,
            userId: session.user.id,
            requestType: attendanceRequestType,
            status: "PENDING",
            title: `${leaveType.name}申請`,
            targetDate,
            payloadJson: {
              source: "LEAVE_REQUEST",
              sourceId: createdLeave.id,
              legacyLeaveRequestId: createdLeave.id,
              leaveTypeId: leaveType.id,
              leaveTypeCode: leaveType.code,
              leaveTypeName: leaveType.name,
              unit,
              hours,
              targetDate: targetDateText,
              reason,
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
            requestId: attendanceRequest.id,
            actorUserId: session.user.id,
            action: "SUBMIT",
            fromStatus: "DRAFT",
            toStatus: "PENDING",
            stepOrder: 1,
            comment: "休暇申請を提出"
          }
        });

        return { leave: createdLeave, attendanceRequest };
      });

      leave = result.leave;
      attendanceRequestMeta = {
        attendanceRequestCreated: true,
        attendanceRequestId: result.attendanceRequest.id,
        attendanceRequestType,
        approvalRouteId: routeResolution.routeId,
        approvalRouteMatchType: routeResolution.matchType
      };
    } catch (error) {
      leave = await prisma.leaveRequest.create({
        data: {
          companyId: session.user.companyId,
          userId: session.user.id,
          leaveTypeId: leaveType.id,
          targetDate,
          unit,
          hours,
          reason
        }
      });
      attendanceRequestMeta = {
        attendanceRequestCreated: false,
        attendanceRequestFailed: true,
        failureReason: error instanceof Error ? error.message : "AttendanceRequest の併記録に失敗しました。"
      };
    }
  } else {
    leave = await prisma.leaveRequest.create({
      data: {
        companyId: session.user.companyId,
        userId: session.user.id,
        leaveTypeId: leaveType.id,
        targetDate,
        unit,
        hours,
        reason
      }
    });
  }

  await logAction({
    request: req,
    userId: session.user.id,
    companyId: session.user.companyId,
    action: "CREATE_LEAVE",
    targetType: "LEAVE",
    targetId: leave.id,
    after: leave,
    meta: { leaveTypeName: leaveType.name, targetDate: targetDateText, ...attendanceRequestMeta }
  });

  return Response.json({ ok: true });
}
