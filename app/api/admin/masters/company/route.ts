import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeClosingDay } from "@/lib/period-lock";

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  await prisma.company.update({
    where: { id: session.user.companyId },
    data: {
      name: body.name,
      code: body.code,
      closingDay: normalizeClosingDay(Number(body.closingDay))
    }
  });

  return NextResponse.json({ ok: true });
}
