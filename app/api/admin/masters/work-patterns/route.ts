import { logAction } from "@/lib/audit-log";
import { apiError, requireAdmin } from "@/lib/authz";
import { isCareCompany } from "@/lib/industry";
import { prisma } from "@/lib/prisma";
import { defaultWorkPatternFlags, normalizeWorkPatternCategory } from "@/lib/work-pattern-category";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));
  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { industryType: true }
  });
  const isCare = isCareCompany(company?.industryType);
  const category = isCare ? normalizeWorkPatternCategory(body.category) : "DAY";
  const defaults = defaultWorkPatternFlags(category);

  try {
    const pattern = await prisma.workPattern.create({
      data: {
        companyId: session.user.companyId,
        code: body.code,
        name: body.name,
        category,
        startTime: body.startTime,
        endTime: body.endTime,
        breakMinutes: Number(body.breakMinutes ?? 60),
        colorClass: body.colorClass ?? "bg-emerald-400 text-slate-900",
        displayColor: body.displayColor ?? "emerald",
        isHoliday: isCare ? Boolean(body.isHoliday ?? defaults.isHoliday) : Boolean(body.isHoliday),
        isNightShift: isCare ? Boolean(body.isNightShift ?? defaults.isNightShift) : false,
        autoCreateAfterNight: isCare ? Boolean(body.autoCreateAfterNight ?? defaults.autoCreateAfterNight) : false,
        countsAsWork: isCare ? Boolean(body.countsAsWork ?? defaults.countsAsWork) : true,
        countsAsLeave: isCare ? Boolean(body.countsAsLeave ?? defaults.countsAsLeave) : false,
        sortOrder: Number(body.sortOrder ?? 0),
        isActive: Boolean(body.isActive)
      }
    });

    await logAction({
      request: req,
      userId: session.user.id,
      companyId: session.user.companyId,
      action: "CREATE_WORK_PATTERN",
      targetType: "WORK_PATTERN",
      targetId: pattern.id,
      after: pattern,
      meta: { isCare }
    });

    return Response.json({ ok: true });
  } catch {
    return apiError("登録に失敗しました。コードが重複している可能性があります。", 400);
  }
}
