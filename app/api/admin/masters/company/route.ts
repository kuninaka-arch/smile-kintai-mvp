import { IndustryType } from "@prisma/client";
import { logAction } from "@/lib/audit-log";
import { apiError, requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { normalizeClosingDay } from "@/lib/period-lock";

const industryTypes = new Set<string>([
  IndustryType.general,
  IndustryType.care,
  IndustryType.restaurant,
  IndustryType.cleaning,
  IndustryType.construction
]);

function canChangeIndustry(role: string | undefined, roleCode: string | null | undefined) {
  if (role !== "ADMIN") return false;
  const normalizedRoleCode = roleCode?.toLowerCase();
  return !normalizedRoleCode || ["admin", "system_admin", "company_admin"].includes(normalizedRoleCode);
}

export async function PUT(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));
  const requestedIndustryType = String(body.industryType ?? "general");
  if (!industryTypes.has(requestedIndustryType)) {
    return apiError("業種モードの値が正しくありません。", 400);
  }

  const [company, actor] = await Promise.all([
    prisma.company.findUniqueOrThrow({
      where: { id: session.user.companyId },
      select: { id: true, name: true, code: true, closingDay: true, industryType: true }
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true, roleMaster: { select: { code: true } } }
    })
  ]);

  const industryChanged = company.industryType !== requestedIndustryType;
  if (industryChanged && !canChangeIndustry(actor?.role, actor?.roleMaster?.code)) {
    return apiError("業種モードは system_admin または company_admin のみ変更できます。", 403);
  }

  const updated = await prisma.company.update({
    where: { id: session.user.companyId },
    data: {
      name: String(body.name ?? ""),
      code: String(body.code ?? ""),
      closingDay: normalizeClosingDay(Number(body.closingDay)),
      industryType: requestedIndustryType as IndustryType
    },
    select: { id: true, name: true, code: true, closingDay: true, industryType: true }
  });

  await logAction({
    request: req,
    userId: session.user.id,
    companyId: session.user.companyId,
    action: "UPDATE_COMPANY",
    targetType: "COMPANY",
    targetId: updated.id,
    before: company,
    after: updated,
    meta: { industryChanged }
  });

  return Response.json({ ok: true });
}
