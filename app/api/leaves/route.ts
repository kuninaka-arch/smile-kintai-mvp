import { LeaveRequestUnit } from "@prisma/client";
import { logAction } from "@/lib/audit-log";
import { apiError, requireCompanyUser, requireUnlockedDate } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

function tokyoDate(date: string) {
  return new Date(`${date}T00:00:00+09:00`);
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

  const leave = await prisma.leaveRequest.create({
    data: {
      companyId: session.user.companyId,
      userId: session.user.id,
      leaveTypeId: leaveType.id,
      targetDate,
      unit,
      hours,
      reason: String(body.reason ?? "")
    }
  });

  await logAction({
    request: req,
    userId: session.user.id,
    companyId: session.user.companyId,
    action: "CREATE_LEAVE",
    targetType: "LEAVE",
    targetId: leave.id,
    after: leave,
    meta: { leaveTypeName: leaveType.name, targetDate: targetDateText }
  });

  return Response.json({ ok: true });
}
