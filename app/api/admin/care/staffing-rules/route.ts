import { WorkPatternCategory } from "@prisma/client";
import { logAction } from "@/lib/audit-log";
import { requireCareCompany } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

const targetCategories = new Set<WorkPatternCategory>([
  WorkPatternCategory.EARLY,
  WorkPatternCategory.DAY,
  WorkPatternCategory.LATE,
  WorkPatternCategory.NIGHT
]);

export async function POST(req: Request) {
  const auth = await requireCareCompany();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));
  const rules = Array.isArray(body.rules) ? body.rules : [];
  const before = await prisma.careStaffingRule.findMany({
    where: { companyId: session.user.companyId, floorId: null, departmentId: null },
    orderBy: { category: "asc" }
  });

  const updatedRules = await prisma.$transaction(async (tx) => {
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

    return tx.careStaffingRule.findMany({
      where: { companyId: session.user.companyId, floorId: null, departmentId: null },
      orderBy: { category: "asc" }
    });
  });

  await logAction({
    request: req,
    userId: session.user.id,
    companyId: session.user.companyId,
    action: "SAVE_STAFFING_RULES",
    targetType: "STAFFING_RULE",
    targetId: session.user.companyId,
    before,
    after: updatedRules
  });

  return Response.json({ ok: true });
}
