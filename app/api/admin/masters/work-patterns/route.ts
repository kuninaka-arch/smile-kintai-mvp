import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  try {
    await prisma.workPattern.create({
      data: {
        companyId: session.user.companyId,
        code: body.code,
        name: body.name,
        startTime: body.startTime,
        endTime: body.endTime,
        breakMinutes: Number(body.breakMinutes ?? 60),
        colorClass: body.colorClass ?? "bg-emerald-400 text-slate-900",
        isHoliday: Boolean(body.isHoliday),
        sortOrder: Number(body.sortOrder ?? 0),
        isActive: Boolean(body.isActive)
      }
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "登録に失敗しました。コードが重複している可能性があります。" }, { status: 400 });
  }
}
