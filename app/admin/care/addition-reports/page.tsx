import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { WorkPatternCategory } from "@prisma/client";
import { AdminSidebar } from "@/components/AdminSidebar";
import { requireAdmin } from "@/components/RequireAuth";
import { minutesToHHMM } from "@/lib/attendance";
import { isCareCompany } from "@/lib/industry";
import { prisma } from "@/lib/prisma";

const staffingCategories = [
  { category: WorkPatternCategory.EARLY, label: "早番" },
  { category: WorkPatternCategory.DAY, label: "日勤" },
  { category: WorkPatternCategory.LATE, label: "遅番" },
  { category: WorkPatternCategory.NIGHT, label: "夜勤" }
] as const;

const workCategorySet = new Set<WorkPatternCategory>(staffingCategories.map((item) => item.category));
const defaultStandardMinutes = 160 * 60;

type AdditionStatus = "達成" | "注意" | "不足";

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function tokyoMonthRange(year: number, month: number) {
  const start = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+09:00`);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = new Date(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+09:00`);
  return { start, end };
}

function dateKey(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function monthLabel(year: number, month: number) {
  return `${year}年${month}月`;
}

function buildMonthNav(ym: string, direction: -1 | 1) {
  const [year, month] = ym.split("-").map(Number);
  const date = new Date(year, month - 1 + direction, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function timeToMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return 0;
  return hour * 60 + minute;
}

function plannedMinutes(shift: {
  startTime: string;
  endTime: string;
  breakMinutes: number;
  workPattern: { countsAsWork: boolean; isHoliday: boolean } | null;
}) {
  if (!shift.workPattern?.countsAsWork || shift.workPattern.isHoliday) return 0;
  if (shift.startTime === "00:00" && shift.endTime === "00:00") return 0;
  const start = timeToMinutes(shift.startTime);
  let end = timeToMinutes(shift.endTime);
  if (end <= start) end += 24 * 60;
  return Math.max(0, end - start - shift.breakMinutes);
}

function assessAdditionStatus(shortageCount: number): AdditionStatus {
  if (shortageCount === 0) return "達成";
  if (shortageCount <= 3) return "注意";
  return "不足";
}

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
  const now = new Date();
  const ym = searchParams.ym ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [year, month] = ym.split("-").map(Number);

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { industryType: true }
  });

  if (!isCareCompany(company?.industryType)) {
    redirect("/admin");
  }

  const { start, end } = tokyoMonthRange(year, month);
  const dayCount = daysInMonth(year, month);

  const [staffingRules, shifts, fteRule, usersForFte, qualifications] = await Promise.all([
    prisma.careStaffingRule.findMany({
      where: {
        companyId: session.user.companyId,
        category: { in: staffingCategories.map((item) => item.category) },
        floorId: null,
        departmentId: null
      }
    }),
    prisma.shift.findMany({
      where: {
        companyId: session.user.companyId,
        workDate: { gte: start, lt: end }
      },
      select: {
        workDate: true,
        user: {
          select: {
            id: true,
            name: true,
            qualifications: { select: { qualificationId: true } }
          }
        },
        workPattern: {
          select: {
            category: true
          }
        }
      }
    }),
    prisma.careFullTimeEquivalentRule.findFirst({
      where: { companyId: session.user.companyId },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.user.findMany({
      where: { companyId: session.user.companyId },
      select: {
        id: true,
        jobType: true,
        isFullTime: true,
        shifts: {
          where: { workDate: { gte: start, lt: end } },
          select: {
            startTime: true,
            endTime: true,
            breakMinutes: true,
            workPattern: { select: { countsAsWork: true, isHoliday: true } }
          }
        }
      },
      orderBy: [{ jobType: "asc" }, { displayOrder: "asc" }, { createdAt: "asc" }]
    }),
    prisma.qualificationMaster.findMany({
      where: { companyId: session.user.companyId },
      include: { careQualificationRules: true },
      orderBy: [{ name: "asc" }, { createdAt: "asc" }]
    })
  ]);

  const requiredByCategory = new Map<WorkPatternCategory, number>();
  for (const item of staffingCategories) {
    requiredByCategory.set(item.category, 0);
  }
  for (const rule of staffingRules) {
    requiredByCategory.set(rule.category, rule.requiredCount);
  }

  const assignedByDateAndCategory = new Map<string, Map<WorkPatternCategory, number>>();
  const nightShiftsByDate = new Map<string, typeof shifts>();
  const nightCountByUser = new Map<string, { name: string; count: number }>();
  const assignedByDateAndQualification = new Map<string, Map<string, Map<string, string>>>();

  for (const shift of shifts) {
    const category = shift.workPattern?.category;
    if (!category || !workCategorySet.has(category)) continue;

    const key = dateKey(shift.workDate);
    const perCategory = assignedByDateAndCategory.get(key) ?? new Map<WorkPatternCategory, number>();
    perCategory.set(category, (perCategory.get(category) ?? 0) + 1);
    assignedByDateAndCategory.set(key, perCategory);

    const perQualification = assignedByDateAndQualification.get(key) ?? new Map<string, Map<string, string>>();
    for (const qualification of shift.user.qualifications) {
      const staff = perQualification.get(qualification.qualificationId) ?? new Map<string, string>();
      staff.set(shift.user.id, shift.user.name);
      perQualification.set(qualification.qualificationId, staff);
    }
    assignedByDateAndQualification.set(key, perQualification);

    if (category === WorkPatternCategory.NIGHT) {
      nightShiftsByDate.set(key, [...(nightShiftsByDate.get(key) ?? []), shift]);
      const current = nightCountByUser.get(shift.user.id) ?? { name: shift.user.name, count: 0 };
      current.count += 1;
      nightCountByUser.set(shift.user.id, current);
    }
  }

  const dates = Array.from({ length: dayCount }, (_, index) => {
    const day = index + 1;
    const date = new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+09:00`);
    return {
      date,
      key: dateKey(date),
      day,
      weekday: new Intl.DateTimeFormat("ja-JP", { weekday: "short", timeZone: "Asia/Tokyo" }).format(date)
    };
  });

  const staffingShortageRows = dates
    .map((date) => {
      const shortages = staffingCategories
        .map((item) => {
          const required = requiredByCategory.get(item.category) ?? 0;
          const assigned = assignedByDateAndCategory.get(date.key)?.get(item.category) ?? 0;
          return {
            label: item.label,
            missing: Math.max(0, required - assigned)
          };
        })
        .filter((item) => item.missing > 0);

      return { ...date, shortages };
    })
    .filter((row) => row.shortages.length > 0);

  const qualificationRows = qualifications.map((qualification) => ({
    id: qualification.id,
    name: qualification.name,
    requiredCount: qualification.careQualificationRules[0]?.requiredCount ?? 0
  }));

  const qualificationShortageRows = dates
    .map((date) => {
      const perQualification = assignedByDateAndQualification.get(date.key) ?? new Map<string, Map<string, string>>();
      const shortages = qualificationRows
        .map((qualification) => {
          const assigned = perQualification.get(qualification.id)?.size ?? 0;
          return {
            name: qualification.name,
            missing: Math.max(0, qualification.requiredCount - assigned)
          };
        })
        .filter((item) => item.missing > 0);

      return { ...date, shortages };
    })
    .filter((row) => row.shortages.length > 0);

  const qualificationShortageCounts = new Map<string, number>();
  for (const row of qualificationShortageRows) {
    for (const shortage of row.shortages) {
      qualificationShortageCounts.set(shortage.name, (qualificationShortageCounts.get(shortage.name) ?? 0) + 1);
    }
  }
  const topQualificationShortages = Array.from(qualificationShortageCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"));

  const requiredNightCount = requiredByCategory.get(WorkPatternCategory.NIGHT) ?? 0;
  const nightShortageRows = dates
    .map((date) => {
      const assigned = nightShiftsByDate.get(date.key)?.length ?? 0;
      return {
        ...date,
        assigned,
        missing: Math.max(0, requiredNightCount - assigned)
      };
    })
    .filter((row) => row.missing > 0);

  const staffNightCounts = Array.from(nightCountByUser.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"));

  const standardMonthlyMinutes = fteRule?.standardMonthlyMinutes ?? defaultStandardMinutes;
  const fteRowsByJobType = new Map<string, { jobType: string; count: number; monthlyMinutes: number }>();
  for (const user of usersForFte) {
    const jobType = user.jobType?.trim() || "未設定";
    const current = fteRowsByJobType.get(jobType) ?? { jobType, count: 0, monthlyMinutes: 0 };
    current.count += 1;
    current.monthlyMinutes += user.shifts.reduce((sum, shift) => sum + plannedMinutes(shift), 0);
    fteRowsByJobType.set(jobType, current);
  }

  const fteRows = Array.from(fteRowsByJobType.values())
    .map((row) => ({
      ...row,
      fte: standardMonthlyMinutes > 0 ? row.monthlyMinutes / standardMonthlyMinutes : 0
    }))
    .sort((a, b) => b.fte - a.fte || a.jobType.localeCompare(b.jobType, "ja"));
  const totalMinutes = fteRows.reduce((sum, row) => sum + row.monthlyMinutes, 0);
  const totalFte = standardMonthlyMinutes > 0 ? totalMinutes / standardMonthlyMinutes : 0;

  const totalShortageDays = staffingShortageRows.length + qualificationShortageRows.length + nightShortageRows.length;
  const status = assessAdditionStatus(totalShortageDays);

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
            <div className="flex items-center gap-2">
              <Link href={`/admin/care/addition-reports?ym=${buildMonthNav(ym, -1)}`} className="rounded-xl border bg-white px-3 py-2 font-black text-slate-700">
                前月
              </Link>
              <div className="rounded-xl border bg-white px-4 py-2 font-black text-slate-900">{monthLabel(year, month)}</div>
              <Link href={`/admin/care/addition-reports?ym=${buildMonthNav(ym, 1)}`} className="rounded-xl border bg-white px-3 py-2 font-black text-slate-700">
                翌月
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-6 px-5 py-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <SummaryCard label="今月の加算資料状況" value={status} badgeClassName={statusClassName(status)} />
            <SummaryCard label="人員配置不足日数" value={`${staffingShortageRows.length}日`} valueClassName={shortageTextClassName(staffingShortageRows.length)} />
            <SummaryCard label="資格者配置不足日数" value={`${qualificationShortageRows.length}日`} valueClassName={shortageTextClassName(qualificationShortageRows.length)} />
            <SummaryCard label="夜勤配置不足日数" value={`${nightShortageRows.length}日`} valueClassName={shortageTextClassName(nightShortageRows.length)} />
            <SummaryCard label="常勤換算 合計" value={totalFte.toFixed(2)} />
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <p className="text-sm font-bold text-slate-500">出力機能</p>
              <p className="mt-2 text-base font-black text-orange-600">PDF / Excel出力は次フェーズで対応予定</p>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <DashboardPanel title="人員配置サマリー" href={`/admin/care/staffing?ym=${ym}`} linkLabel="人員配置表を開く">
              <p className="text-sm font-bold text-slate-500">不足日数</p>
              <p className={`mt-1 text-3xl font-black ${shortageTextClassName(staffingShortageRows.length)}`}>{staffingShortageRows.length}日</p>
              <SimpleList
                emptyText="人員配置の不足はありません。"
                items={staffingShortageRows.slice(0, 5).map((row) => ({
                  key: row.key,
                  title: `${row.day}日（${row.weekday}）`,
                  detail: row.shortages.map((item) => `${item.label} ${item.missing}名不足`).join(" / ")
                }))}
              />
            </DashboardPanel>

            <DashboardPanel title="資格者配置サマリー" href={`/admin/care/qualifications?ym=${ym}`} linkLabel="資格者配置表を開く">
              <p className="text-sm font-bold text-slate-500">不足日数</p>
              <p className={`mt-1 text-3xl font-black ${shortageTextClassName(qualificationShortageRows.length)}`}>{qualificationShortageRows.length}日</p>
              <SimpleList
                emptyText="資格者配置の不足はありません。"
                items={topQualificationShortages.slice(0, 5).map((item) => ({
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
                  <p className={`mt-1 text-3xl font-black ${shortageTextClassName(nightShortageRows.length)}`}>{nightShortageRows.length}日</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-500">必要夜勤人数</p>
                  <p className="mt-1 text-3xl font-black text-slate-900">{requiredNightCount}名</p>
                </div>
              </div>
              <SimpleList
                emptyText="夜勤回数の登録はまだありません。"
                items={staffNightCounts.slice(0, 5).map((item) => ({
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
                  <p className="mt-1 text-3xl font-black text-emerald-700">{totalFte.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-500">基準月間時間</p>
                  <p className="mt-1 text-3xl font-black text-slate-900">{minutesToHHMM(standardMonthlyMinutes)}</p>
                </div>
              </div>
              <SimpleList
                emptyText="常勤換算の対象スタッフがありません。"
                items={fteRows.slice(0, 5).map((row) => ({
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
