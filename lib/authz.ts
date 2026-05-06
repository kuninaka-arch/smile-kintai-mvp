import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { isCareCompany, isGeneralCompany } from "@/lib/industry";
import { isDateLocked } from "@/lib/period-lock";
import { prisma } from "@/lib/prisma";

export type ApiAuthResult =
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse };

export function apiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireLogin(): Promise<ApiAuthResult> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { ok: false, response: apiError("ログインが必要です。", 401) };
  }
  return { ok: true, session };
}

export async function requireAdmin(): Promise<ApiAuthResult> {
  const auth = await requireLogin();
  if (!auth.ok) return auth;

  if (auth.session.user.role !== "ADMIN") {
    return { ok: false, response: apiError("管理者権限が必要です。", 403) };
  }

  return auth;
}

export async function requireCompanyUser(): Promise<ApiAuthResult> {
  const auth = await requireLogin();
  if (!auth.ok) return auth;

  const user = await prisma.user.findFirst({
    where: {
      id: auth.session.user.id,
      companyId: auth.session.user.companyId
    },
    select: { id: true }
  });

  if (!user) {
    return { ok: false, response: apiError("ユーザー情報を確認できません。再ログインしてください。", 401) };
  }

  return auth;
}

export async function requireCareCompany(): Promise<ApiAuthResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const company = await prisma.company.findUnique({
    where: { id: auth.session.user.companyId },
    select: { industryType: true }
  });

  if (!isCareCompany(company?.industryType)) {
    return { ok: false, response: apiError("介護施設モードの会社のみ利用できます。", 403) };
  }

  return auth;
}

export async function requireGeneralCompany(): Promise<ApiAuthResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const company = await prisma.company.findUnique({
    where: { id: auth.session.user.companyId },
    select: { industryType: true }
  });

  if (!isGeneralCompany(company?.industryType)) {
    return { ok: false, response: apiError("一般企業モードの会社のみ利用できます。", 403) };
  }

  return auth;
}

export async function requireUnlockedDate(companyId: string, date: Date, targetLabel = "対象日") {
  if (await isDateLocked(companyId, date)) {
    return apiError(`締め済み期間のため、${targetLabel}は変更できません。`, 423);
  }
  return null;
}
