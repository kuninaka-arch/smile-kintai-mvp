import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { IndustryType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
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
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const requestedIndustryType = String(body.industryType ?? "general");
  if (!industryTypes.has(requestedIndustryType)) {
    return NextResponse.json({ error: "業種モードの値が不正です。" }, { status: 400 });
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
    return NextResponse.json({ error: "業種モードは system_admin または company_admin のみ変更できます。" }, { status: 403 });
  }

  const headerList = headers();
  const ipAddress = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headerList.get("x-real-ip") ?? null;
  const userAgent = headerList.get("user-agent");

  await prisma.$transaction(async (tx) => {
    const updated = await tx.company.update({
      where: { id: session.user.companyId },
      data: {
        name: body.name,
        code: body.code,
        closingDay: normalizeClosingDay(Number(body.closingDay)),
        industryType: requestedIndustryType as IndustryType
      },
      select: { id: true, name: true, code: true, closingDay: true, industryType: true }
    });

    if (industryChanged) {
      await tx.auditLog.create({
        data: {
          companyId: session.user.companyId,
          actorUserId: session.user.id,
          action: "company.industryType.update",
          targetType: "Company",
          targetId: session.user.companyId,
          beforeJson: { industryType: company.industryType },
          afterJson: { industryType: updated.industryType },
          ipAddress,
          userAgent
        }
      });
    }
  });

  return NextResponse.json({ ok: true });
}
