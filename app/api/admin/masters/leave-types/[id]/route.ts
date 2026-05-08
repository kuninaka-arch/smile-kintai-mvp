import { NextResponse } from "next/server";
import { logAction } from "@/lib/audit-log";
import { apiError, requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json();

  try {
    const item = await prisma.leaveTypeMaster.findFirst({
      where: { id: params.id, companyId: session.user.companyId }
    });

    if (!item) {
      return apiError("対象データが見つかりません。", 404);
    }

    const updated = await prisma.leaveTypeMaster.update({
      where: { id: params.id },
      data: {
        code: body.code,
        name: body.name,
        allowHourly: Boolean(body.allowHourly),
        sortOrder: Number(body.sortOrder ?? 0),
        isActive: Boolean(body.isActive)
      }
    });

    await logAction({
      request: req,
      userId: session.user.id,
      companyId: session.user.companyId,
      action: "UPDATE_LEAVE_TYPE",
      targetType: "LEAVE_TYPE",
      targetId: updated.id,
      before: item,
      after: updated
    });

    return NextResponse.json({ ok: true });
  } catch {
    return apiError("更新に失敗しました。", 400);
  }
}
