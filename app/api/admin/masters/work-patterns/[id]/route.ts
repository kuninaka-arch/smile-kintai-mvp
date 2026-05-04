import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isCareCompany } from "@/lib/industry";
import { prisma } from "@/lib/prisma";
import { defaultWorkPatternFlags, normalizeWorkPatternCategory } from "@/lib/work-pattern-category";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const item = await prisma.workPattern.findFirst({
    where: { id: params.id, companyId: session.user.companyId }
  });

  if (!item) return NextResponse.json({ error: "対象が見つかりません。" }, { status: 404 });

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { industryType: true }
  });
  const isCare = isCareCompany(company?.industryType);
  const category = isCare ? normalizeWorkPatternCategory(body.category) : item.category;
  const defaults = defaultWorkPatternFlags(category);

  await prisma.workPattern.update({
    where: { id: params.id },
    data: {
      code: body.code,
      name: body.name,
      category,
      startTime: body.startTime,
      endTime: body.endTime,
      breakMinutes: Number(body.breakMinutes ?? 60),
      colorClass: body.colorClass ?? "bg-emerald-400 text-slate-900",
      displayColor: body.displayColor ?? item.displayColor,
      isHoliday: isCare ? Boolean(body.isHoliday ?? defaults.isHoliday) : Boolean(body.isHoliday),
      isNightShift: isCare ? Boolean(body.isNightShift ?? defaults.isNightShift) : item.isNightShift,
      autoCreateAfterNight: isCare ? Boolean(body.autoCreateAfterNight ?? defaults.autoCreateAfterNight) : item.autoCreateAfterNight,
      countsAsWork: isCare ? Boolean(body.countsAsWork ?? defaults.countsAsWork) : item.countsAsWork,
      countsAsLeave: isCare ? Boolean(body.countsAsLeave ?? defaults.countsAsLeave) : item.countsAsLeave,
      sortOrder: Number(body.sortOrder ?? 0),
      isActive: Boolean(body.isActive)
    }
  });

  return NextResponse.json({ ok: true });
}
