import Link from "next/link";
import { redirect } from "next/navigation";
import { WorkPatternCategory } from "@prisma/client";
import { AdminSidebar } from "@/components/AdminSidebar";
import { requireAdmin } from "@/components/RequireAuth";
import { isCareCompany } from "@/lib/industry";
import { prisma } from "@/lib/prisma";

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

export default async function CareNightShiftPage({ searchParams }: { searchParams: { ym?: string } }) {
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
  const [nightRule, nightShifts] = await Promise.all([
    prisma.careStaffingRule.findFirst({
      where: {
        companyId: session.user.companyId,
        category: WorkPatternCategory.NIGHT,
        floorId: null,
        departmentId: null
      },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.shift.findMany({
      where: {
        companyId: session.user.companyId,
        workDate: { gte: start, lt: end },
        workPattern: { category: WorkPatternCategory.NIGHT }
      },
      select: {
        workDate: true,
        startTime: true,
        endTime: true,
        patternCode: true,
        user: {
          select: {
            id: true,
            name: true,
            department: true
          }
        },
        workPattern: {
          select: {
            name: true
          }
        }
      },
      orderBy: [{ workDate: "asc" }, { startTime: "asc" }]
    })
  ]);

  const requiredNightCount = nightRule?.requiredCount ?? 0;
  const hasNightRule = Boolean(nightRule);
  const dayCount = daysInMonth(year, month);
  const shiftsByDate = new Map<string, typeof nightShifts>();
  const nightCountByUser = new Map<string, { name: string; department: string | null; count: number }>();

  for (const shift of nightShifts) {
    const key = dateKey(shift.workDate);
    shiftsByDate.set(key, [...(shiftsByDate.get(key) ?? []), shift]);

    const current = nightCountByUser.get(shift.user.id) ?? {
      name: shift.user.name,
      department: shift.user.department,
      count: 0
    };
    current.count += 1;
    nightCountByUser.set(shift.user.id, current);
  }

  const rows = Array.from({ length: dayCount }, (_, index) => {
    const day = index + 1;
    const date = new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+09:00`);
    const key = dateKey(date);
    const shifts = shiftsByDate.get(key) ?? [];
    const count = shifts.length;
    const ok = count >= requiredNightCount;

    return {
      date: key,
      day,
      weekday: new Intl.DateTimeFormat("ja-JP", { weekday: "short", timeZone: "Asia/Tokyo" }).format(date),
      shifts,
      count,
      ok
    };
  });

  const shortageDays = rows.filter((row) => !row.ok).length;
  const totalNightShifts = nightShifts.length;
  const staffNightCounts = Array.from(nightCountByUser.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"));

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="care-night-shift" />

      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-emerald-700">介護施設モード</p>
              <h1 className="text-2xl font-black text-slate-900">夜勤体制表</h1>
              <p className="mt-1 text-sm text-slate-500">
                月別に夜勤者、夜勤人数、必要夜勤人数、スタッフ別夜勤回数を確認します。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/admin/care/night-shift?ym=${buildMonthNav(ym, -1)}`} className="rounded-xl border bg-white px-3 py-2 font-black text-slate-700">
                前月
              </Link>
              <div className="rounded-xl border bg-white px-4 py-2 font-black text-slate-900">{monthLabel(year, month)}</div>
              <Link href={`/admin/care/night-shift?ym=${buildMonthNav(ym, 1)}`} className="rounded-xl border bg-white px-3 py-2 font-black text-slate-700">
                翌月
              </Link>
              <Link href="/admin/care/staffing-rules" className="rounded-xl bg-slate-900 px-4 py-2 font-black text-white">
                夜勤基準設定
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-6 px-5 py-6">
          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard label="対象月" value={monthLabel(year, month)} />
            <SummaryCard label="必要夜勤人数" value={hasNightRule ? `${requiredNightCount}名` : "未設定"} />
            <SummaryCard label="夜勤総回数" value={`${totalNightShifts}回`} />
            <SummaryCard label="不足日数" value={`${shortageDays}日`} danger={shortageDays > 0} />
          </div>

          <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="border-b p-5">
              <h2 className="text-lg font-black text-slate-900">月別 夜勤体制</h2>
              <p className="text-sm text-slate-500">
                勤務パターンの区分が「夜勤」のシフトを集計しています。
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="p-4">日付</th>
                    <th className="p-4">曜日</th>
                    <th className="p-4">夜勤者</th>
                    <th className="p-4">夜勤人数</th>
                    <th className="p-4">必要夜勤人数</th>
                    <th className="p-4">判定</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.date} className={row.ok ? "border-t bg-white" : "border-t bg-red-50"}>
                      <td className="p-4 font-black text-slate-900">{row.day}日</td>
                      <td className="p-4 font-bold text-slate-600">{row.weekday}</td>
                      <td className="p-4">
                        {row.shifts.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {row.shifts.map((shift) => (
                              <span key={`${row.date}-${shift.user.id}-${shift.startTime}`} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
                                {shift.user.name}
                                <span className="ml-1 text-indigo-500">
                                  {shift.patternCode ?? shift.workPattern?.name ?? ""}
                                </span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-4 font-bold">{row.count}名</td>
                      <td className="p-4 font-bold">{hasNightRule ? `${requiredNightCount}名` : "未設定"}</td>
                      <td className="p-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${row.ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                          {row.ok ? "OK" : "不足"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="border-b p-5">
              <h2 className="text-lg font-black text-slate-900">スタッフ別 夜勤回数</h2>
              <p className="text-sm text-slate-500">対象月に夜勤シフトへ入っているスタッフを回数順に表示します。</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="p-4">スタッフ名</th>
                    <th className="p-4">所属</th>
                    <th className="p-4">夜勤回数</th>
                  </tr>
                </thead>
                <tbody>
                  {staffNightCounts.map((staff) => (
                    <tr key={staff.name} className="border-t">
                      <td className="p-4 font-black text-slate-900">{staff.name}</td>
                      <td className="p-4 text-slate-600">{staff.department ?? "-"}</td>
                      <td className="p-4 text-lg font-black text-indigo-700">{staff.count}回</td>
                    </tr>
                  ))}
                  {staffNightCounts.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-8 text-center font-bold text-slate-500">
                        対象月の夜勤シフトはまだありません。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <p className="text-sm leading-6 text-slate-500">
            今回は月内の夜勤シフトを日付ごとに集計しています。月末跨ぎの明け補正、深夜労働時間、夜勤手当は後続フェーズで扱います。
          </p>
        </div>
      </section>
    </main>
  );
}

function SummaryCard({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-black ${danger ? "text-red-600" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}
