import { logAction } from "@/lib/audit-log";
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

  const saved = existing
    ? await prisma.careFullTimeEquivalentRule.update({
        where: { id: existing.id },
        data: { standardMonthlyMinutes }
      })
    : await prisma.careFullTimeEquivalentRule.create({
        data: {
          companyId: session.user.companyId,
          standardMonthlyMinutes
        }
      });

  await logAction({
    request: req,
    userId: session.user.id,
    companyId: session.user.companyId,
    action: "SAVE_FTE_RULE",
    targetType: "FTE_RULE",
    targetId: saved.id,
    before: existing,
    after: saved,
    meta: { standardMonthlyHours }
  });

  return Response.json({ ok: true });
}
