import { AttendanceType } from "@prisma/client";
import { logAction } from "@/lib/audit-log";
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

  await logAction({
    request: req,
    userId: session.user.id,
    companyId: session.user.companyId,
    action: "CREATE_CORRECTION",
    targetType: "CORRECTION",
    targetId: correction.id,
    after: correction,
    meta: { targetDate: targetDateText, requestedTime: requestedTimeText }
  });

  return Response.json({ ok: true });
}
