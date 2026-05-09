import { LeaveRequestStatus, LeaveRequestUnit, WorkPatternCategory } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { logAction } from "@/lib/audit-log";
import {
  createApprovalHistoryForDecision,
  resolveStepProgressDecisionForAttendanceRequest
} from "@/lib/approval-engine";
import { resolveApprovalPermission } from "@/lib/approval-permissions";
import { apiError, requireAdmin, requireUnlockedDate } from "@/lib/authz";
import { isCareCompany } from "@/lib/industry";
import { prisma } from "@/lib/prisma";

const validStatuses: LeaveRequestStatus[] = ["APPROVED", "REJECTED"];

class LeaveAlreadyProcessedError extends Error {
  constructor() {
    super("LeaveRequest is already processed.");
  }
}

class LinkedAttendanceRequestAlreadyProcessedError extends Error {
  constructor() {
    super("Linked AttendanceRequest is already processed.");
  }
}

class ExistingShiftOverwriteRequiredError extends Error {
  constructor() {
    super("Existing shift overwrite confirmation is required.");
  }
}

type LeaveRequestForApproval = {
  id: string;
  companyId: string;
  userId: string;
  targetDate: Date;
  unit: LeaveRequestUnit;
  hours: number | null;
  leaveType: {
    code: string;
    name: string;
  };
};

function isPaidLeaveType(code: string, name: string) {
  const text = `${code} ${name}`.toUpperCase();
  return /PAID|YU|有休|有給/.test(text);
}

function colorForLeave(code: string) {
  if (code === "PAID") return "bg-amber-200 text-slate-900";
  if (code === "COMP") return "bg-sky-200 text-slate-900";
  if (code === "BEREAVEMENT") return "bg-slate-300 text-slate-900";
  return "bg-violet-200 text-slate-900";
}

function tokyoDateKey(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function tokyoDateRange(date: Date) {
  const key = tokyoDateKey(date);
  const start = new Date(`${key}T00:00:00+09:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

async function findExistingShiftForLeave(
  client: Prisma.TransactionClient | typeof prisma,
  request: LeaveRequestForApproval
) {
  if (request.unit !== LeaveRequestUnit.FULL_DAY) return null;

  const { start, end } = tokyoDateRange(request.targetDate);
  return client.shift.findFirst({
    where: {
      companyId: request.companyId,
      userId: request.userId,
      workDate: { gte: start, lt: end }
    },
    orderBy: { workDate: "asc" }
  });
}

function leavePatternCategory(code: string, name: string) {
  const text = `${code} ${name}`.toUpperCase();
  if (/PAID|YU|有休|有給/.test(text)) return WorkPatternCategory.PAID_LEAVE;
  if (/REQUEST|HOPE|希望休/.test(text)) return WorkPatternCategory.REQUESTED_OFF;
  return WorkPatternCategory.OFF;
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

async function findLinkedLeaveAttendanceRequests({
  companyId,
  leaveRequestId
}: {
  companyId: string;
  leaveRequestId: string;
}) {
  const candidates = await prisma.attendanceRequest.findMany({
    where: {
      companyId,
      requestType: { in: ["PAID_LEAVE", "SUBSTITUTE_LEAVE"] },
      AND: [
        {
          payloadJson: {
            path: ["source"],
            equals: "LEAVE_REQUEST"
          }
        },
        {
          payloadJson: {
            path: ["legacyLeaveRequestId"],
            equals: leaveRequestId
          }
        }
      ]
    },
    select: {
      id: true,
      requestType: true,
      status: true,
      currentStepOrder: true,
      payloadJson: true
    }
  });

  return candidates.filter((candidate) => {
    const sourceId = payloadString(candidate.payloadJson, "sourceId");
    return !sourceId || sourceId === leaveRequestId;
  });
}

async function applyLeaveRequestFinalApprovalEffects({
  tx,
  request,
  careMode,
  consumePaidLeave,
  overwriteExistingShift
}: {
  tx: Prisma.TransactionClient;
  request: LeaveRequestForApproval;
  careMode: boolean;
  consumePaidLeave: boolean;
  overwriteExistingShift: boolean;
}) {
  const existingShift = await findExistingShiftForLeave(tx, request);
  if (existingShift && !overwriteExistingShift) {
    throw new ExistingShiftOverwriteRequiredError();
  }

  if (consumePaidLeave) {
    const usedDays = request.unit === LeaveRequestUnit.HOUR
      ? Number(request.hours ?? 0) / 8
      : 1;

    const paidLeave = await tx.paidLeave.findFirst({
      where: { companyId: request.companyId, userId: request.userId }
    });
    if (paidLeave) {
      await tx.paidLeave.update({
        where: { id: paidLeave.id },
        data: { usedDays: paidLeave.usedDays + usedDays }
      });
    } else {
      await tx.paidLeave.create({
        data: { companyId: request.companyId, userId: request.userId, grantedDays: 0, usedDays }
      });
    }
  }

  if (request.unit !== LeaveRequestUnit.FULL_DAY) return;

  const category = leavePatternCategory(request.leaveType.code, request.leaveType.name);
  const pattern = await tx.workPattern.upsert({
    where: { companyId_code: { companyId: request.companyId, code: request.leaveType.code } },
    update: {
      name: request.leaveType.name,
      category,
      startTime: "00:00",
      endTime: "00:00",
      breakMinutes: 0,
      isHoliday: true,
      countsAsWork: false,
      countsAsLeave: category === WorkPatternCategory.PAID_LEAVE,
      isActive: true
    },
    create: {
      companyId: request.companyId,
      code: request.leaveType.code,
      name: request.leaveType.name,
      category,
      startTime: "00:00",
      endTime: "00:00",
      breakMinutes: 0,
      colorClass: colorForLeave(request.leaveType.code),
      isHoliday: true,
      countsAsWork: false,
      countsAsLeave: category === WorkPatternCategory.PAID_LEAVE,
      sortOrder: 80,
      isActive: true
    }
  });

  const { start, end } = tokyoDateRange(request.targetDate);
  const shiftData = {
    workDate: start,
    startTime: "00:00",
    endTime: "00:00",
    breakMinutes: 0,
    patternCode: pattern.code,
    workPatternId: pattern.id
  };
  if (existingShift) {
    if (careMode && !overwriteExistingShift) return;
    await tx.shift.update({ where: { id: existingShift.id }, data: shiftData });
    await tx.shift.deleteMany({
      where: {
        companyId: request.companyId,
        userId: request.userId,
        workDate: { gte: start, lt: end },
        id: { not: existingShift.id }
      }
    });
  } else {
    await tx.shift.create({
      data: {
        companyId: request.companyId,
        userId: request.userId,
        ...shiftData
      }
    });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));
  const status = body.status as LeaveRequestStatus;
  const overwriteExistingShift = body.overwriteExistingShift === true;
  if (!validStatuses.includes(status)) {
    return apiError("休暇申請の処理状態が正しくありません。", 400);
  }

  const request = await prisma.leaveRequest.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
    include: { leaveType: true }
  });
  if (!request) return apiError("休暇申請が見つかりません。", 404);

  if (request.status !== "PENDING") {
    await logAction({
      request: req,
      userId: session.user.id,
      companyId: session.user.companyId,
      action: "DENY_LEAVE_ALREADY_PROCESSED",
      targetType: "LEAVE",
      targetId: request.id,
      before: request,
      meta: {
        reason: "LeaveRequest is already processed.",
        leaveRequestId: request.id,
        currentStatus: request.status,
        requestedStatus: status
      }
    });

    return apiError("この休暇申請はすでに処理済みです。", 409);
  }

  const lockError = await requireUnlockedDate(session.user.companyId, request.targetDate, "休暇申請");
  if (lockError) return lockError;

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { industryType: true }
  });
  const careMode = isCareCompany(company?.industryType);
  const linkedAttendanceRequests = await findLinkedLeaveAttendanceRequests({
    companyId: session.user.companyId,
    leaveRequestId: request.id
  });

  if (linkedAttendanceRequests.length > 1) {
    await logAction({
      request: req,
      userId: session.user.id,
      companyId: session.user.companyId,
      action: "DENY_LEAVE_ATTENDANCE_REQUEST_AMBIGUOUS",
      targetType: "LEAVE",
      targetId: request.id,
      before: request,
      meta: {
        reason: "Multiple linked AttendanceRequests were found.",
        leaveRequestId: request.id,
        requestedStatus: status,
        attendanceRequestIds: linkedAttendanceRequests.map((attendanceRequest) => attendanceRequest.id)
      }
    });

    return apiError("紐づく共通申請が複数見つかりました。", 409);
  }

  const linkedAttendanceRequest = linkedAttendanceRequests[0] ?? null;
  if (linkedAttendanceRequest) {
    const approvalDecision = await resolveStepProgressDecisionForAttendanceRequest({
      companyId: session.user.companyId,
      attendanceRequestId: linkedAttendanceRequest.id,
      actorUserId: session.user.id,
      action: status === "APPROVED" ? "APPROVE" : "REJECT"
    });

    if (!approvalDecision.ok) {
      const denyAction =
        approvalDecision.action === "DUPLICATE"
          ? "DENY_LEAVE_APPROVAL_DUPLICATE"
          : approvalDecision.action === "UNSUPPORTED"
            ? "DENY_LEAVE_APPROVAL_UNSUPPORTED"
            : "DENY_LEAVE_APPROVAL_PERMISSION";

      await logAction({
        request: req,
        userId: session.user.id,
        companyId: session.user.companyId,
        action: denyAction,
        targetType: "LEAVE",
        targetId: request.id,
        before: request,
        meta: {
          leaveRequestId: request.id,
          requestedStatus: status,
          attendanceRequestId: linkedAttendanceRequest.id,
          decisionAction: approvalDecision.action,
          reason: approvalDecision.reason,
          ...approvalDecision.auditMeta
        }
      });

      return apiError(approvalDecision.reason ?? "承認処理を続行できません。", approvalDecision.statusCode ?? 403);
    }

    const approvalPermission = await resolveApprovalPermission({
      attendanceRequestId: linkedAttendanceRequest.id,
      actorUserId: session.user.id,
      companyId: session.user.companyId
    });

    if (!approvalPermission.canApprove) {
      await logAction({
        request: req,
        userId: session.user.id,
        companyId: session.user.companyId,
        action: "DENY_LEAVE_APPROVAL_PERMISSION",
        targetType: "LEAVE",
        targetId: request.id,
        before: request,
        meta: {
          leaveRequestId: request.id,
          requestedStatus: status,
          attendanceRequestId: linkedAttendanceRequest.id,
          approvalPermissionCanApprove: false,
          approvalPermissionReason: approvalPermission.reason,
          approvalPermissionCurrentStepOrder: approvalPermission.currentStepOrder,
          decisionAction: approvalDecision.action,
          ...approvalDecision.auditMeta
        }
      });

      return apiError(`承認権限がありません。${approvalPermission.reason}`, 403);
    }

    let updated: unknown = request;
    let attendanceRequestSyncMeta: Record<string, unknown> = {
      attendanceRequestSynced: false,
      attendanceRequestId: linkedAttendanceRequest.id
    };

    try {
      if (approvalDecision.action === "PENDING") {
        await prisma.$transaction(async (tx) => {
          const currentAttendanceRequest = await tx.attendanceRequest.findFirst({
            where: { id: linkedAttendanceRequest.id, companyId: session.user.companyId },
            select: { status: true }
          });

          if (currentAttendanceRequest?.status !== "PENDING") {
            throw new LinkedAttendanceRequestAlreadyProcessedError();
          }

          await createApprovalHistoryForDecision({
            companyId: session.user.companyId,
            actorUserId: session.user.id,
            decision: approvalDecision,
            client: tx
          });
        });

        attendanceRequestSyncMeta = {
          attendanceRequestSynced: true,
          attendanceRequestId: linkedAttendanceRequest.id,
          attendanceRequestFromStatus: "PENDING",
          attendanceRequestToStatus: "PENDING",
          attendanceRequestCurrentStepOrder: approvalDecision.currentStepOrder,
          attendanceRequestNextStepOrder: approvalDecision.currentStepOrder
        };
      } else if (approvalDecision.action === "ADVANCE_STEP") {
        if (approvalDecision.currentStepOrder == null || approvalDecision.nextStepOrder == null) {
          return apiError("承認ステップ情報が不正です。", 422);
        }

        await prisma.$transaction(async (tx) => {
          const updateResult = await tx.attendanceRequest.updateMany({
            where: {
              id: linkedAttendanceRequest.id,
              companyId: session.user.companyId,
              status: "PENDING",
              currentStepOrder: approvalDecision.currentStepOrder
            },
            data: { currentStepOrder: approvalDecision.nextStepOrder }
          });

          if (updateResult.count !== 1) {
            throw new LinkedAttendanceRequestAlreadyProcessedError();
          }

          await createApprovalHistoryForDecision({
            companyId: session.user.companyId,
            actorUserId: session.user.id,
            decision: approvalDecision,
            client: tx
          });
        });

        attendanceRequestSyncMeta = {
          attendanceRequestSynced: true,
          attendanceRequestId: linkedAttendanceRequest.id,
          attendanceRequestFromStatus: "PENDING",
          attendanceRequestToStatus: "PENDING",
          attendanceRequestCurrentStepOrder: approvalDecision.currentStepOrder,
          attendanceRequestNextStepOrder: approvalDecision.nextStepOrder
        };
      } else if (approvalDecision.action === "FINAL_APPROVE" || approvalDecision.action === "FINAL_REJECT") {
        const nextStatus = approvalDecision.action === "FINAL_APPROVE" ? "APPROVED" : "REJECTED";
        const resolvedAt = new Date();

        updated = await prisma.$transaction(async (tx) => {
          const leaveUpdateResult = await tx.leaveRequest.updateMany({
            where: { id: request.id, companyId: session.user.companyId, status: "PENDING" },
            data: {
              status: nextStatus,
              approvedAt: nextStatus === "APPROVED" ? resolvedAt : null
            }
          });

          if (leaveUpdateResult.count !== 1) {
            throw new LeaveAlreadyProcessedError();
          }

          const attendanceRequestUpdateResult = await tx.attendanceRequest.updateMany({
            where: { id: linkedAttendanceRequest.id, companyId: session.user.companyId, status: "PENDING" },
            data: {
              status: nextStatus,
              resolvedAt
            }
          });

          if (attendanceRequestUpdateResult.count !== 1) {
            throw new LinkedAttendanceRequestAlreadyProcessedError();
          }

          await createApprovalHistoryForDecision({
            companyId: session.user.companyId,
            actorUserId: session.user.id,
            decision: approvalDecision,
            client: tx
          });

          if (nextStatus === "APPROVED") {
            await applyLeaveRequestFinalApprovalEffects({
              tx,
              request,
              careMode,
              consumePaidLeave: linkedAttendanceRequest.requestType === "PAID_LEAVE",
              overwriteExistingShift
            });
          }

          return tx.leaveRequest.findUniqueOrThrow({
            where: { id: request.id }
          });
        });

        attendanceRequestSyncMeta = {
          attendanceRequestSynced: true,
          attendanceRequestId: linkedAttendanceRequest.id,
          attendanceRequestFromStatus: "PENDING",
          attendanceRequestToStatus: nextStatus,
          attendanceRequestCurrentStepOrder: approvalDecision.currentStepOrder,
          attendanceRequestNextStepOrder: approvalDecision.nextStepOrder,
          attendanceRequestResolvedAt: resolvedAt.toISOString()
        };
      }
    } catch (error) {
      if (error instanceof ExistingShiftOverwriteRequiredError) {
        await logAction({
          request: req,
          userId: session.user.id,
          companyId: session.user.companyId,
          action: "DENY_LEAVE_SHIFT_OVERWRITE_REQUIRED",
          targetType: "LEAVE",
          targetId: request.id,
          before: request,
          meta: {
            reason: error.message,
            leaveRequestId: request.id,
            requestedStatus: status,
            attendanceRequestId: linkedAttendanceRequest.id
          }
        });

        return apiError("既存シフトがあります。承認済み休暇で既存シフトを上書きする場合は確認してください。", 409);
      }

      if (!(error instanceof LeaveAlreadyProcessedError) && !(error instanceof LinkedAttendanceRequestAlreadyProcessedError)) {
        throw error;
      }

      const currentRequest = await prisma.leaveRequest.findFirst({
        where: { id: params.id, companyId: session.user.companyId },
        include: { leaveType: true }
      });
      const currentAttendanceRequest = await prisma.attendanceRequest.findFirst({
        where: { id: linkedAttendanceRequest.id, companyId: session.user.companyId },
        select: { status: true, currentStepOrder: true }
      });

      await logAction({
        request: req,
        userId: session.user.id,
        companyId: session.user.companyId,
        action: "DENY_LEAVE_ALREADY_PROCESSED",
        targetType: "LEAVE",
        targetId: request.id,
        before: currentRequest ?? request,
        meta: {
          reason: error.message,
          leaveRequestId: request.id,
          currentStatus: currentRequest?.status ?? request.status,
          requestedStatus: status,
          attendanceRequestId: linkedAttendanceRequest.id,
          attendanceRequestStatus: currentAttendanceRequest?.status ?? null,
          attendanceRequestCurrentStepOrder: currentAttendanceRequest?.currentStepOrder ?? null
        }
      });

      return apiError("この休暇申請はすでに処理済みです。", 409);
    }

    await logAction({
      request: req,
      userId: session.user.id,
      companyId: session.user.companyId,
      action: status === "APPROVED" ? "APPROVE_LEAVE" : "REJECT_LEAVE",
      targetType: "LEAVE",
      targetId: request.id,
      before: request,
      after: updated,
      meta: {
        status,
        leaveTypeName: request.leaveType.name,
        attendanceRequestDecisionUsed: true,
        approvalPermissionCanApprove: true,
        approvalPermissionReason: approvalPermission.reason,
        approvalPermissionCurrentStepOrder: approvalPermission.currentStepOrder,
        decisionAction: approvalDecision.action,
        ...attendanceRequestSyncMeta,
        ...approvalDecision.auditMeta
      }
    });

    return Response.json({ ok: true });
  }

  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.leaveRequest.updateMany({
        where: { id: request.id, companyId: session.user.companyId, status: "PENDING" },
        data: { status, approvedAt: status === "APPROVED" ? new Date() : null }
      });

      if (updateResult.count !== 1) {
        throw new LeaveAlreadyProcessedError();
      }

      const updatedRequest = await tx.leaveRequest.findUniqueOrThrow({
        where: { id: request.id }
      });

      if (status !== "APPROVED") return updatedRequest;

      if (isPaidLeaveType(request.leaveType.code, request.leaveType.name)) {
        const usedDays = request.unit === LeaveRequestUnit.HOUR
          ? Number(request.hours ?? 0) / 8
          : 1;

        const paidLeave = await tx.paidLeave.findFirst({
          where: { companyId: request.companyId, userId: request.userId }
        });
        if (paidLeave) {
          await tx.paidLeave.update({
            where: { id: paidLeave.id },
            data: { usedDays: paidLeave.usedDays + usedDays }
          });
        } else {
          await tx.paidLeave.create({
            data: { companyId: request.companyId, userId: request.userId, grantedDays: 0, usedDays }
          });
        }
      }

      if (request.unit === LeaveRequestUnit.FULL_DAY) {
        const category = leavePatternCategory(request.leaveType.code, request.leaveType.name);
        const pattern = await tx.workPattern.upsert({
          where: { companyId_code: { companyId: request.companyId, code: request.leaveType.code } },
          update: {
            name: request.leaveType.name,
            category,
            startTime: "00:00",
            endTime: "00:00",
            breakMinutes: 0,
            isHoliday: true,
            countsAsWork: false,
            countsAsLeave: category === WorkPatternCategory.PAID_LEAVE,
            isActive: true
          },
          create: {
            companyId: request.companyId,
            code: request.leaveType.code,
            name: request.leaveType.name,
            category,
            startTime: "00:00",
            endTime: "00:00",
            breakMinutes: 0,
            colorClass: colorForLeave(request.leaveType.code),
            isHoliday: true,
            countsAsWork: false,
            countsAsLeave: category === WorkPatternCategory.PAID_LEAVE,
            sortOrder: 80,
            isActive: true
          }
        });

        const { start, end } = tokyoDateRange(request.targetDate);
        const existingShift = await tx.shift.findFirst({
          where: {
            companyId: request.companyId,
            userId: request.userId,
            workDate: { gte: start, lt: end }
          },
          orderBy: { workDate: "asc" }
        });
        if (existingShift && !overwriteExistingShift) {
          throw new ExistingShiftOverwriteRequiredError();
        }
        const shiftData = {
          workDate: start,
          startTime: "00:00",
          endTime: "00:00",
          breakMinutes: 0,
          patternCode: pattern.code,
          workPatternId: pattern.id
        };
        if (existingShift) {
          if (careMode && !overwriteExistingShift) return updatedRequest;
          await tx.shift.update({ where: { id: existingShift.id }, data: shiftData });
          await tx.shift.deleteMany({
            where: {
              companyId: request.companyId,
              userId: request.userId,
              workDate: { gte: start, lt: end },
              id: { not: existingShift.id }
            }
          });
        } else {
          await tx.shift.create({
            data: {
              companyId: request.companyId,
              userId: request.userId,
              ...shiftData
            }
          });
        }
      }

      return updatedRequest;
    });
  } catch (error) {
    if (error instanceof ExistingShiftOverwriteRequiredError) {
      await logAction({
        request: req,
        userId: session.user.id,
        companyId: session.user.companyId,
        action: "DENY_LEAVE_SHIFT_OVERWRITE_REQUIRED",
        targetType: "LEAVE",
        targetId: request.id,
        before: request,
        meta: {
          reason: error.message,
          leaveRequestId: request.id,
          requestedStatus: status
        }
      });

      return apiError("既存シフトがあります。承認済み休暇で既存シフトを上書きする場合は確認してください。", 409);
    }

    if (!(error instanceof LeaveAlreadyProcessedError)) throw error;

    const currentRequest = await prisma.leaveRequest.findFirst({
      where: { id: params.id, companyId: session.user.companyId },
      include: { leaveType: true }
    });

    await logAction({
      request: req,
      userId: session.user.id,
      companyId: session.user.companyId,
      action: "DENY_LEAVE_ALREADY_PROCESSED",
      targetType: "LEAVE",
      targetId: request.id,
      before: currentRequest ?? request,
      meta: {
        reason: "LeaveRequest is already processed.",
        leaveRequestId: request.id,
        currentStatus: currentRequest?.status ?? request.status,
        requestedStatus: status
      }
    });

    return apiError("この休暇申請はすでに処理済みです。", 409);
  }

  await logAction({
    request: req,
    userId: session.user.id,
    companyId: session.user.companyId,
    action: status === "APPROVED" ? "APPROVE_LEAVE" : "REJECT_LEAVE",
    targetType: "LEAVE",
    targetId: request.id,
    before: request,
    after: updated,
    meta: { status, leaveTypeName: request.leaveType.name }
  });

  return Response.json({ ok: true });
}
