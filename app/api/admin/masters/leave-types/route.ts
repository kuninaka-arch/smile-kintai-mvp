import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  try {
    await prisma.leaveTypeMaster.create({
      data: {
        companyId: session.user.companyId,
        code: body.code,
        name: body.name,
        allowHourly: Boolean(body.allowHourly),
        sortOrder: Number(body.sortOrder ?? 0),
        isActive: Boolean(body.isActive)
      }
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "登録に失敗しました。コードが重複している可能性があります。" }, { status: 400 });
  }
}
