import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isCareCompany } from "@/lib/industry";
import { prisma } from "@/lib/prisma";

const defaultQualifications = ["介護福祉士", "看護師", "准看護師", "PT", "OT", "ST", "介護支援専門員", "生活相談員"];

async function requireCareAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { industryType: true }
  });
  if (!isCareCompany(company?.industryType)) {
    return { error: NextResponse.json({ error: "Care mode only" }, { status: 403 }) };
  }

  return { session };
}

export async function POST(req: Request) {
  const auth = await requireCareAdmin();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");
  const companyId = auth.session.user.companyId;

  if (action === "seedDefaults") {
    await prisma.$transaction(
      defaultQualifications.map((name) =>
        prisma.qualificationMaster.upsert({
          where: { companyId_name: { companyId, name } },
          update: {},
          create: { companyId, name }
        })
      )
    );
    return NextResponse.json({ ok: true, message: "標準資格を追加しました。" });
  }

  if (action === "createQualification") {
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "資格名を入力してください。" }, { status: 400 });
    await prisma.qualificationMaster.upsert({
      where: { companyId_name: { companyId, name } },
      update: {},
      create: { companyId, name }
    });
    return NextResponse.json({ ok: true, message: "資格を追加しました。" });
  }

  if (action === "assignQualification") {
    const userId = String(body.userId ?? "");
    const qualificationId = String(body.qualificationId ?? "");
    const [user, qualification] = await Promise.all([
      prisma.user.findFirst({ where: { id: userId, companyId }, select: { id: true } }),
      prisma.qualificationMaster.findFirst({ where: { id: qualificationId, companyId }, select: { id: true } })
    ]);
    if (!user || !qualification) return NextResponse.json({ error: "対象データが見つかりません。" }, { status: 404 });

    await prisma.userQualification.upsert({
      where: { userId_qualificationId: { userId, qualificationId } },
      update: {},
      create: { userId, qualificationId }
    });
    return NextResponse.json({ ok: true, message: "スタッフへ資格を付与しました。" });
  }

  if (action === "removeUserQualification") {
    const userQualificationId = String(body.userQualificationId ?? "");
    const target = await prisma.userQualification.findFirst({
      where: {
        id: userQualificationId,
        user: { companyId }
      },
      select: { id: true }
    });
    if (!target) return NextResponse.json({ error: "対象資格が見つかりません。" }, { status: 404 });

    await prisma.userQualification.delete({ where: { id: target.id } });
    return NextResponse.json({ ok: true, message: "スタッフ資格を外しました。" });
  }

  if (action === "saveRules") {
    const rules = Array.isArray(body.rules) ? body.rules : [];
    await prisma.$transaction(async (tx) => {
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
    });
    return NextResponse.json({ ok: true, message: "資格別必要人数を保存しました。" });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
