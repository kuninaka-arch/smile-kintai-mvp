import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isCareCompany } from "@/lib/industry";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { industryType: true }
  });
  if (!isCareCompany(company?.industryType)) {
    return NextResponse.json({ error: "Care mode only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const standardMonthlyHours = Number(body.standardMonthlyHours ?? 160);
  const standardMonthlyMinutes = Number.isFinite(standardMonthlyHours)
    ? Math.max(1, Math.round(standardMonthlyHours * 60))
    : 160 * 60;

  const existing = await prisma.careFullTimeEquivalentRule.findFirst({
    where: { companyId: session.user.companyId }
  });

  if (existing) {
    await prisma.careFullTimeEquivalentRule.update({
      where: { id: existing.id },
      data: { standardMonthlyMinutes }
    });
  } else {
    await prisma.careFullTimeEquivalentRule.create({
      data: {
        companyId: session.user.companyId,
        standardMonthlyMinutes
      }
    });
  }

  return NextResponse.json({ ok: true });
}
