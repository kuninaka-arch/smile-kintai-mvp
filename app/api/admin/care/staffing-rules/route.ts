import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { WorkPatternCategory } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { isCareCompany } from "@/lib/industry";
import { prisma } from "@/lib/prisma";

const targetCategories = new Set<WorkPatternCategory>([
  WorkPatternCategory.EARLY,
  WorkPatternCategory.DAY,
  WorkPatternCategory.LATE,
  WorkPatternCategory.NIGHT
]);

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
  const rules = Array.isArray(body.rules) ? body.rules : [];

  await prisma.$transaction(async (tx) => {
    for (const rule of rules) {
      const category = rule.category as WorkPatternCategory;
      if (!targetCategories.has(category)) continue;

      const parsedCount = Number(rule.requiredCount ?? 0);
      const requiredCount = Number.isFinite(parsedCount) ? Math.max(0, Math.floor(parsedCount)) : 0;
      const existing = await tx.careStaffingRule.findFirst({
        where: {
          companyId: session.user.companyId,
          category,
          floorId: null,
          departmentId: null
        }
      });

      if (existing) {
        await tx.careStaffingRule.update({
          where: { id: existing.id },
          data: { requiredCount }
        });
      } else {
        await tx.careStaffingRule.create({
          data: {
            companyId: session.user.companyId,
            category,
            requiredCount
          }
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}
