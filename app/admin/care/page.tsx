import Link from "next/link";
import { redirect } from "next/navigation";
import { WorkPatternCategory } from "@prisma/client";
import { AdminSidebar } from "@/components/AdminSidebar";
import { requireAdmin } from "@/components/RequireAuth";
import { buildCareAdditionReportSummary, parseCareAdditionYm, type AdditionStatus } from "@/lib/care-addition-report";
import { isCareCompany } from "@/lib/industry";
import { prisma } from "@/lib/prisma";

const dashboardLinks = [
  { href: "/admin/shifts", label: "シフト管理", description: "月間シフトを確認・編集" },
  { href: "/admin/monthly", label: "勤怠管理", description: "月次勤怠集計を確認" },
  { href: "/admin/leaves", label: "休暇・希望休", description: "申請の承認状況を確認" },
  { href: "/admin/care/staffing", label: "人員配置表", description: "日別の配置不足を確認" },
  { href: "/admin/care/full-time-equivalent", label: "常勤換算表", description: "職種別の常勤換算を確認" },
  { href: "/admin/care/qualifications", label: "資格者配置表", description: "資格者の配置状況を確認" },
  { href: "/admin/care/night-shift", label: "夜勤体制表", description: "夜勤者と不足日を確認" },
  { href: "/admin/care/addition-reports", label: "加算資料", description: "加算資料サマリーを確認" }
];

function todayTokyoRange() {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
  const start = new Date(`${parts}T00:00:00+09:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { key: parts, start, end };
}

function statusClassName(status: AdditionStatus) {
  if (status === "達成") return "text-emerald-700 bg-emerald-100";
  if (status === "注意") return "text-orange-700 bg-orange-100";
  return "text-red-700 bg-red-100";
}

function shortageClassName(count: number) {
  return count > 0 ? "text-red-600" : "text-emerald-600";
}

export default async function CareDashboardPage() {
  const session = await requireAdmin();
  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { industryType: true }
  });

  if (!isCareCompany(company?.industryType)) {
    redirect("/admin");
  }

  const { key: todayKey, start: todayStart, end: todayEnd } = todayTokyoRange();
  const { ym } = parseCareAdditionYm(todayKey.slice(0, 7));

  const [todayShifts, pendingLeaveCount, summary] = await Promise.all([
    prisma.shift.findMany({
      where: {
        companyId: session.user.companyId,
        workDate: { gte: todayStart, lt: todayEnd }
      },
      select: {
        userId: true,
        workPattern: {
          select: {
            category: true,
            countsAsWork: true,
            isHoliday: true
          }
        }
      }
    }),
    prisma.leaveRequest.count({
      where: {
        companyId: session.user.companyId,
        status: "PENDING"
      }
    }),
    buildCareAdditionReportSummary(session.user.companyId, ym)
  ]);

  const workingUserIds = new Set(
    todayShifts
      .filter((shift) => shift.workPattern?.countsAsWork && !shift.workPattern.isHoliday)
      .map((shift) => shift.userId)
  );
  const nightUserIds = new Set(
    todayShifts
      .filter((shift) => shift.workPattern?.category === WorkPatternCategory.NIGHT)
      .map((shift) => shift.userId)
  );

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="care" />

      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-emerald-700">介護施設モード</p>
              <h1 className="text-2xl font-black text-slate-900">介護ダッシュボード</h1>
              <p className="mt-1 text-sm text-slate-500">
                本日の勤務状況と加算資料の確認ポイントをまとめて表示します。
              </p>
            </div>
            <div className="rounded-xl border bg-white px-4 py-2 text-sm font-black text-slate-700">
              本日 {todayKey}
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-6 px-5 py-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <DashboardCard label="本日の出勤者数" value={`${workingUserIds.size}名`} />
            <DashboardCard label="本日の夜勤者数" value={`${nightUserIds.size}名`} />
            <DashboardCard label="休暇・希望休申請数" value={`${pendingLeaveCount}件`} valueClassName={pendingLeaveCount > 0 ? "text-orange-600" : "text-emerald-600"} />
            <DashboardCard label="人員配置不足日数" value={`${summary.staffingShortageDays}日`} valueClassName={shortageClassName(summary.staffingShortageDays)} />
            <DashboardCard label="加算資料状況" value={summary.status} badgeClassName={statusClassName(summary.status)} />
            <DashboardCard label="常勤換算合計" value={summary.totalFte.toFixed(2)} />
          </section>

          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="mb-4 border-b pb-4">
              <h2 className="text-lg font-black text-slate-900">主要機能</h2>
              <p className="text-sm text-slate-500">介護モードの各画面へ移動して動作確認できます。</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {dashboardLinks.map((link) => (
                <Link key={link.href} href={link.href} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-300 hover:bg-blue-50">
                  <p className="font-black text-slate-900">{link.label}</p>
                  <p className="mt-1 text-sm font-bold text-slate-500">{link.description}</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm leading-6 text-blue-900">
            <h2 className="font-black">デモ確認メモ</h2>
            <p className="mt-2">
              出勤者数と夜勤者数は本日のシフトから集計しています。休暇・希望休申請数は未承認の申請数です。
              加算資料状況と常勤換算合計は当月の加算資料サマリーを利用しています。
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}

function DashboardCard({
  label,
  value,
  valueClassName = "text-slate-900",
  badgeClassName
}: {
  label: string;
  value: string;
  valueClassName?: string;
  badgeClassName?: string;
}) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      {badgeClassName ? (
        <span className={`mt-3 inline-flex rounded-full px-4 py-2 text-2xl font-black ${badgeClassName}`}>{value}</span>
      ) : (
        <p className={`mt-2 text-3xl font-black ${valueClassName}`}>{value}</p>
      )}
    </div>
  );
}
