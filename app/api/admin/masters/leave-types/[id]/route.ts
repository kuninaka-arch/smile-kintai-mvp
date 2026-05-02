import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  try {
    const item = await prisma.leaveTypeMaster.findFirst({
      where: { id: params.id, companyId: session.user.companyId }
    });

    if (!item) {
      return NextResponse.json({ error: "対象が見つかりません。" }, { status: 404 });
    }

    await prisma.leaveTypeMaster.update({
      where: { id: params.id },
      data: {
        code: body.code,
        name: body.name,
        allowHourly: Boolean(body.allowHourly),
        sortOrder: Number(body.sortOrder ?? 0),
        isActive: Boolean(body.isActive)
      }
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "更新に失敗しました。" }, { status: 400 });
  }
}
