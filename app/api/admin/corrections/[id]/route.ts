import { CorrectionStatus } from "@prisma/client";
import { logAction } from "@/lib/audit-log";
import { apiError, requireAdmin, requireUnlockedDate } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

const validStatuses: CorrectionStatus[] = ["APPROVED", "REJECTED"];

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

  await logAction({
    request: req,
    userId: session.user.id,
    companyId: session.user.companyId,
    action: status === "APPROVED" ? "APPROVE_CORRECTION" : "REJECT_CORRECTION",
    targetType: "CORRECTION",
    targetId: request.id,
    before: request,
    after: updated,
    meta: { status }
  });

  return Response.json({ ok: true });
}
