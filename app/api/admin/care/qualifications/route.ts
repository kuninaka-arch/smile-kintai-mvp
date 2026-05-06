import { logAction } from "@/lib/audit-log";
import { apiError, requireCareCompany } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

const defaultQualifications = ["介護福祉士", "看護師", "准看護師", "PT", "OT", "ST", "介護支援専門員", "生活相談員"];

export async function POST(req: Request) {
  const auth = await requireCareCompany();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");
  const companyId = session.user.companyId;

  if (action === "seedDefaults") {
    const before = await prisma.qualificationMaster.findMany({
      where: { companyId, name: { in: defaultQualifications } },
      orderBy: { name: "asc" }
    });
    const saved = await prisma.$transaction(
      defaultQualifications.map((name) =>
        prisma.qualificationMaster.upsert({
          where: { companyId_name: { companyId, name } },
          update: {},
          create: { companyId, name }
        })
      )
    );
    await logAction({
      request: req,
      userId: session.user.id,
      companyId,
      action: "SEED_QUALIFICATIONS",
      targetType: "QUALIFICATION",
      targetId: companyId,
      before,
      after: saved
    });
    return Response.json({ ok: true, message: "標準資格を追加しました。" });
  }

  if (action === "createQualification") {
    const name = String(body.name ?? "").trim();
    if (!name) return apiError("資格名を入力してください。", 400);
    const before = await prisma.qualificationMaster.findUnique({
      where: { companyId_name: { companyId, name } }
    });
    const qualification = await prisma.qualificationMaster.upsert({
      where: { companyId_name: { companyId, name } },
      update: {},
      create: { companyId, name }
    });
    await logAction({
      request: req,
      userId: session.user.id,
      companyId,
      action: before ? "UPDATE_QUALIFICATION" : "CREATE_QUALIFICATION",
      targetType: "QUALIFICATION",
      targetId: qualification.id,
      before,
      after: qualification
    });
    return Response.json({ ok: true, message: "資格を追加しました。" });
  }

  if (action === "assignQualification") {
    const userId = String(body.userId ?? "");
    const qualificationId = String(body.qualificationId ?? "");
    const [user, qualification, before] = await Promise.all([
      prisma.user.findFirst({ where: { id: userId, companyId }, select: { id: true, name: true } }),
      prisma.qualificationMaster.findFirst({ where: { id: qualificationId, companyId }, select: { id: true, name: true } }),
      prisma.userQualification.findUnique({ where: { userId_qualificationId: { userId, qualificationId } } })
    ]);
    if (!user || !qualification) return apiError("対象データが見つかりません。", 404);

    const userQualification = await prisma.userQualification.upsert({
      where: { userId_qualificationId: { userId, qualificationId } },
      update: {},
      create: { userId, qualificationId }
    });
    await logAction({
      request: req,
      userId: session.user.id,
      companyId,
      action: "ASSIGN_QUALIFICATION",
      targetType: "USER_QUALIFICATION",
      targetId: userQualification.id,
      before,
      after: userQualification,
      meta: { staffName: user.name, qualificationName: qualification.name }
    });
    return Response.json({ ok: true, message: "スタッフへ資格を付与しました。" });
  }

  if (action === "removeUserQualification") {
    const userQualificationId = String(body.userQualificationId ?? "");
    const target = await prisma.userQualification.findFirst({
      where: {
        id: userQualificationId,
        user: { companyId }
      },
      include: {
        user: { select: { id: true, name: true } },
        qualification: { select: { id: true, name: true } }
      }
    });
    if (!target) return apiError("対象資格が見つかりません。", 404);

    await prisma.userQualification.delete({ where: { id: target.id } });
    await logAction({
      request: req,
      userId: session.user.id,
      companyId,
      action: "REMOVE_QUALIFICATION",
      targetType: "USER_QUALIFICATION",
      targetId: target.id,
      before: target,
      after: null,
      meta: { staffName: target.user.name, qualificationName: target.qualification.name }
    });
    return Response.json({ ok: true, message: "スタッフ資格を外しました。" });
  }

  if (action === "saveRules") {
    const rules = Array.isArray(body.rules) ? body.rules : [];
    const before = await prisma.careQualificationRule.findMany({
      where: { companyId },
      orderBy: { qualificationId: "asc" }
    });

    const saved = await prisma.$transaction(async (tx) => {
      for (const rule of rules) {
        const qualificationId = String(rule.qualificationId ?? "");
        const qualification = await tx.qualificationMaster.findFirst({
          where: { id: qualificationId, companyId },
          select: { id: true }
        });
        if (!qualification) continue;

        const parsedCount = Number(rule.requiredCount ?? 0);
        const requiredCount = Number.isFinite(parsedCount) ? Math.max(0, Math.floor(parsedCount)) : 0;
        await tx.careQualificationRule.upsert({
          where: { companyId_qualificationId: { companyId, qualificationId } },
          update: { requiredCount },
          create: { companyId, qualificationId, requiredCount }
        });
      }

      return tx.careQualificationRule.findMany({
        where: { companyId },
        orderBy: { qualificationId: "asc" }
      });
    });
    await logAction({
      request: req,
      userId: session.user.id,
      companyId,
      action: "SAVE_QUALIFICATION_RULES",
      targetType: "QUALIFICATION_RULE",
      targetId: companyId,
      before,
      after: saved
    });
    return Response.json({ ok: true, message: "資格別必要人数を保存しました。" });
  }

  return apiError("操作種別が正しくありません。", 400);
}
