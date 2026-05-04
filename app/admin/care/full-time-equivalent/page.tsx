import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/AdminSidebar";
import { requireAdmin } from "@/components/RequireAuth";
import { minutesToHHMM } from "@/lib/attendance";
import { isCareCompany } from "@/lib/industry";
import { prisma } from "@/lib/prisma";

const defaultStandardMinutes = 160 * 60;

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
  if (!shift.workPattern?.countsAsWork || shift.workPattern?.isHoliday) return 0;
  if (shift.startTime === "00:00" && shift.endTime === "00:00") return 0;
  const start = timeToMinutes(shift.startTime);
  let end = timeToMinutes(shift.endTime);
  if (end <= start) end += 24 * 60;
  return Math.max(0, end - start - shift.breakMinutes);
}

function monthLabel(year: number, month: number) {
  return `${year}年${month}月`;
}

function buildMonthNav(ym: string, direction: -1 | 1) {
  const [year, month] = ym.split("-").map(Number);
  const date = new Date(year, month - 1 + direction, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default async function CareFullTimeEquivalentPage({ searchParams }: { searchParams: { ym?: string } }) {
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
  const [rule, users] = await Promise.all([
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
        monthlyScheduledMinutes: true,
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
    })
  ]);

  const standardMonthlyMinutes = rule?.standardMonthlyMinutes ?? defaultStandardMinutes;
  const rowsByJobType = new Map<string, { jobType: string; count: number; fullTimeCount: number; monthlyMinutes: number; monthlyScheduledMinutes: number }>();

  for (const user of users) {
    const jobType = user.jobType?.trim() || "未設定";
    const current = rowsByJobType.get(jobType) ?? {
      jobType,
      count: 0,
      fullTimeCount: 0,
      monthlyMinutes: 0,
      monthlyScheduledMinutes: 0
    };
    current.count += 1;
    if (user.isFullTime) current.fullTimeCount += 1;
    current.monthlyMinutes += user.shifts.reduce((sum, shift) => sum + plannedMinutes(shift), 0);
    current.monthlyScheduledMinutes += user.monthlyScheduledMinutes ?? 0;
    rowsByJobType.set(jobType, current);
  }

  const rows = Array.from(rowsByJobType.values())
    .map((row) => ({
      ...row,
      fte: standardMonthlyMinutes > 0 ? row.monthlyMinutes / standardMonthlyMinutes : 0
    }))
    .sort((a, b) => a.jobType.localeCompare(b.jobType, "ja"));

  const totalMinutes = rows.reduce((sum, row) => sum + row.monthlyMinutes, 0);
  const totalFte = standardMonthlyMinutes > 0 ? totalMinutes / standardMonthlyMinutes : 0;

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="care-fte" />

      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-emerald-700">介護施設モード</p>
              <h1 className="text-2xl font-black text-slate-900">常勤換算表</h1>
              <p className="mt-1 text-sm text-slate-500">
                シフト上の勤務予定時間を職種別に集計し、常勤換算を算出します。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/admin/care/full-time-equivalent?ym=${buildMonthNav(ym, -1)}`} className="rounded-xl border bg-white px-3 py-2 font-black text-slate-700">
                前月
              </Link>
              <div className="rounded-xl border bg-white px-4 py-2 font-black text-slate-900">{monthLabel(year, month)}</div>
              <Link href={`/admin/care/full-time-equivalent?ym=${buildMonthNav(ym, 1)}`} className="rounded-xl border bg-white px-3 py-2 font-black text-slate-700">
                翌月
              </Link>
              <Link href="/admin/care/full-time-equivalent/settings" className="rounded-xl bg-slate-900 px-4 py-2 font-black text-white">
                基準設定
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-6">
          <div className="mb-5 grid gap-4 md:grid-cols-4">
            <SummaryCard label="対象月" value={monthLabel(year, month)} />
            <SummaryCard label="基準月間時間" value={minutesToHHMM(standardMonthlyMinutes)} />
            <SummaryCard label="月勤務時間合計" value={minutesToHHMM(totalMinutes)} />
            <SummaryCard label="常勤換算合計" value={totalFte.toFixed(2)} />
          </div>

          <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="border-b p-5">
              <h2 className="text-lg font-black text-slate-900">職種別 常勤換算</h2>
              <p className="text-sm text-slate-500">
                {daysInMonth(year, month)}日分のシフト予定から概算しています。
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="p-4">職種</th>
                    <th className="p-4">対象人数</th>
                    <th className="p-4">常勤人数</th>
                    <th className="p-4">月勤務時間合計</th>
                    <th className="p-4">登録月所定時間</th>
                    <th className="p-4">常勤換算</th>
                    <th className="p-4">基準時間</th>
                    <th className="p-4">判定</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.jobType} className="border-t">
                      <td className="p-4 font-black text-slate-900">{row.jobType}</td>
                      <td className="p-4 font-bold">{row.count}名</td>
                      <td className="p-4 font-bold">{row.fullTimeCount}名</td>
                      <td className="p-4 font-bold text-blue-700">{minutesToHHMM(row.monthlyMinutes)}</td>
                      <td className="p-4 font-bold text-slate-600">{row.monthlyScheduledMinutes > 0 ? minutesToHHMM(row.monthlyScheduledMinutes) : "-"}</td>
                      <td className="p-4 text-lg font-black text-emerald-700">{row.fte.toFixed(2)}</td>
                      <td className="p-4 font-bold">{minutesToHHMM(standardMonthlyMinutes)}</td>
                      <td className="p-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${row.monthlyMinutes > 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {row.monthlyMinutes > 0 ? "算出済" : "勤務なし"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center font-bold text-slate-500">
                        対象スタッフがまだ登録されていません。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <p className="mt-4 text-sm leading-6 text-slate-500">
            今回の土台実装では、打刻実績ではなくシフト上の勤務予定時間から概算しています。休み・有給・希望休など勤務扱いではないパターンは集計対象外です。
          </p>
        </div>
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
    </div>
  );
}
