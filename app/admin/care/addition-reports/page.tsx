import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/AdminSidebar";
import { requireAdmin } from "@/components/RequireAuth";
import { minutesToHHMM } from "@/lib/attendance";
import {
  buildCareAdditionMonthNav,
  buildCareAdditionReportSummary,
  parseCareAdditionYm,
  type AdditionStatus
} from "@/lib/care-addition-report";
import { isCareCompany } from "@/lib/industry";
import { prisma } from "@/lib/prisma";

function statusClassName(status: AdditionStatus) {
  if (status === "達成") return "bg-emerald-100 text-emerald-700 ring-emerald-200";
  if (status === "注意") return "bg-orange-100 text-orange-700 ring-orange-200";
  return "bg-red-100 text-red-700 ring-red-200";
}

function shortageTextClassName(count: number) {
  return count > 0 ? "text-red-600" : "text-emerald-600";
}

export default async function CareAdditionReportsPage({ searchParams }: { searchParams: { ym?: string } }) {
  const session = await requireAdmin();
  const { ym } = parseCareAdditionYm(searchParams.ym);

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { industryType: true }
  });

  if (!isCareCompany(company?.industryType)) {
    redirect("/admin");
  }

  const summary = await buildCareAdditionReportSummary(session.user.companyId, ym);

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="care-addition-reports" />

      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-emerald-700">介護施設モード</p>
              <h1 className="text-2xl font-black text-slate-900">加算資料ダッシュボード</h1>
              <p className="mt-1 text-sm text-slate-500">
                人員配置、資格者配置、夜勤体制、常勤換算をまとめて確認します。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/admin/care/addition-reports?ym=${buildCareAdditionMonthNav(ym, -1)}`} className="rounded-xl border bg-white px-3 py-2 font-black text-slate-700">
                前月
              </Link>
              <div className="rounded-xl border bg-white px-4 py-2 font-black text-slate-900">{summary.monthLabel}</div>
              <Link href={`/admin/care/addition-reports?ym=${buildCareAdditionMonthNav(ym, 1)}`} className="rounded-xl border bg-white px-3 py-2 font-black text-slate-700">
                翌月
              </Link>
              <Link href={`/api/admin/care/addition-reports/export?ym=${ym}&fileType=excel`} className="rounded-xl bg-emerald-600 px-4 py-2 font-black text-white">
                Excel出力
              </Link>
              <Link href={`/api/admin/care/addition-reports/export?ym=${ym}&fileType=pdf`} className="rounded-xl bg-slate-900 px-4 py-2 font-black text-white">
                PDF出力
              </Link>
              <Link href="/admin/care/report-exports" className="rounded-xl border bg-white px-4 py-2 font-black text-slate-700">
                出力履歴
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-6 px-5 py-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <SummaryCard label="今月の加算資料状況" value={summary.status} badgeClassName={statusClassName(summary.status)} />
            <SummaryCard label="人員配置不足日数" value={`${summary.staffingShortageDays}日`} valueClassName={shortageTextClassName(summary.staffingShortageDays)} />
            <SummaryCard label="資格者配置不足日数" value={`${summary.qualificationShortageDays}日`} valueClassName={shortageTextClassName(summary.qualificationShortageDays)} />
            <SummaryCard label="夜勤配置不足日数" value={`${summary.nightShortageDays}日`} valueClassName={shortageTextClassName(summary.nightShortageDays)} />
            <SummaryCard label="常勤換算 合計" value={summary.totalFte.toFixed(2)} />
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <p className="text-sm font-bold text-slate-500">出力機能</p>
              <p className="mt-2 text-base font-black text-emerald-700">Excel / PDF 出力に対応</p>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <DashboardPanel title="人員配置サマリー" href={`/admin/care/staffing?ym=${ym}`} linkLabel="人員配置表を開く">
              <p className="text-sm font-bold text-slate-500">不足日数</p>
              <p className={`mt-1 text-3xl font-black ${shortageTextClassName(summary.staffingShortageDays)}`}>{summary.staffingShortageDays}日</p>
              <SimpleList
                emptyText="人員配置の不足はありません。"
                items={summary.staffingShortages.slice(0, 5).map((row) => ({
                  key: row.key,
                  title: `${row.day}日（${row.weekday}）`,
                  detail: row.detail
                }))}
              />
            </DashboardPanel>

            <DashboardPanel title="資格者配置サマリー" href={`/admin/care/qualifications?ym=${ym}`} linkLabel="資格者配置表を開く">
              <p className="text-sm font-bold text-slate-500">不足日数</p>
              <p className={`mt-1 text-3xl font-black ${shortageTextClassName(summary.qualificationShortageDays)}`}>{summary.qualificationShortageDays}日</p>
              <SimpleList
                emptyText="資格者配置の不足はありません。"
                items={summary.qualificationShortages.slice(0, 5).map((item) => ({
                  key: item.name,
                  title: item.name,
                  detail: `${item.count}日で不足`
                }))}
              />
            </DashboardPanel>

            <DashboardPanel title="夜勤体制サマリー" href={`/admin/care/night-shift?ym=${ym}`} linkLabel="夜勤体制表を開く">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-bold text-slate-500">夜勤不足日数</p>
                  <p className={`mt-1 text-3xl font-black ${shortageTextClassName(summary.nightShortageDays)}`}>{summary.nightShortageDays}日</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-500">必要夜勤人数</p>
                  <p className="mt-1 text-3xl font-black text-slate-900">{summary.requiredNightCount}名</p>
                </div>
              </div>
              <SimpleList
                emptyText="夜勤回数の登録はまだありません。"
                items={summary.nightStaffCounts.slice(0, 5).map((item) => ({
                  key: item.name,
                  title: item.name,
                  detail: `${item.count}回`
                }))}
              />
            </DashboardPanel>

            <DashboardPanel title="常勤換算サマリー" href={`/admin/care/full-time-equivalent?ym=${ym}`} linkLabel="常勤換算表を開く">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-bold text-slate-500">常勤換算 合計</p>
                  <p className="mt-1 text-3xl font-black text-emerald-700">{summary.totalFte.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-500">基準月間時間</p>
                  <p className="mt-1 text-3xl font-black text-slate-900">{minutesToHHMM(summary.standardMonthlyMinutes)}</p>
                </div>
              </div>
              <SimpleList
                emptyText="常勤換算の対象スタッフがありません。"
                items={summary.fteRows.slice(0, 5).map((row) => ({
                  key: row.jobType,
                  title: row.jobType,
                  detail: `${row.fte.toFixed(2)}人分 / ${minutesToHHMM(row.monthlyMinutes)}`
                }))}
              />
            </DashboardPanel>
          </section>

          <section className="rounded-3xl border border-orange-200 bg-orange-50 p-5 text-sm leading-6 text-orange-800">
            <h2 className="font-black">今回の判定について</h2>
            <p className="mt-2">
              現時点では法令・加算要件の厳密判定ではなく、システムに設定した必要人数や資格者人数との比較だけで判定しています。
              不足が0件なら「達成」、1〜3件なら「注意」、4件以上なら「不足」として表示します。
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}

function SummaryCard({
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
        <span className={`mt-3 inline-flex rounded-full px-4 py-2 text-2xl font-black ring-1 ${badgeClassName}`}>{value}</span>
      ) : (
        <p className={`mt-2 text-2xl font-black ${valueClassName}`}>{value}</p>
      )}
    </div>
  );
}

function DashboardPanel({
  title,
  href,
  linkLabel,
  children
}: {
  title: string;
  href: string;
  linkLabel: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <h2 className="text-lg font-black text-slate-900">{title}</h2>
        <Link href={href} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">
          {linkLabel}
        </Link>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function SimpleList({
  items,
  emptyText
}: {
  items: { key: string; title: string; detail: string }[];
  emptyText: string;
}) {
  if (items.length === 0) {
    return <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.key} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
          <p className="font-black text-slate-900">{item.title}</p>
          <p className="text-sm font-bold text-slate-600">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}
