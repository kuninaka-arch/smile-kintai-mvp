import { NextResponse } from "next/server";
import { logAction } from "@/lib/audit-log";
import { apiError, requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json();

  try {
    const department = await prisma.department.create({
      data: {
        companyId: session.user.companyId,
        code: body.code,
        name: body.name,
        
        sortOrder: Number(body.sortOrder ?? 0),
        isActive: Boolean(body.isActive)
      }
    });

    await logAction({
      request: req,
      userId: session.user.id,
      companyId: session.user.companyId,
      action: "CREATE_DEPARTMENT",
      targetType: "DEPARTMENT",
      targetId: department.id,
      after: department
    });

    return NextResponse.json({ ok: true });
  } catch {
    return apiError("登録に失敗しました。コードが重複している可能性があります。", 400);
  }
}
