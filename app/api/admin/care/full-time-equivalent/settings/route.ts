import { NextResponse } from "next/server";
import { requireCareCompany } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const auth = await requireCareCompany();
  if (!auth.ok) return auth.response;
  const { session } = auth;

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
