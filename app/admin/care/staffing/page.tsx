import Link from "next/link";
import { redirect } from "next/navigation";
import { WorkPatternCategory } from "@prisma/client";
import { AdminSidebar } from "@/components/AdminSidebar";
import { requireAdmin } from "@/components/RequireAuth";
import { isCareCompany } from "@/lib/industry";
import { prisma } from "@/lib/prisma";

const targetCategories = [
  { category: WorkPatternCategory.EARLY, label: "早番" },
  { category: WorkPatternCategory.DAY, label: "日勤" },
  { category: WorkPatternCategory.LATE, label: "遅番" },
  { category: WorkPatternCategory.NIGHT, label: "夜勤" }
] as const;

type StaffingCell = {
  required: number;
  assigned: number;
  ok: boolean;
};

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function dateKey(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function tokyoMonthRange(year: number, month: number) {
  const start = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+09:00`);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = new Date(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+09:00`);
  return { start, end };
}

function monthLabel(year: number, month: number) {
  return `${year}年${month}月`;
}

function buildMonthNav(ym: string, direction: -1 | 1) {
  const [year, month] = ym.split("-").map(Number);
  const date = new Date(year, month - 1 + direction, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default async function CareStaffingPage({ searchParams }: { searchParams: { ym?: string } }) {
  const session = await requireAdmin();
  const now = new Date();
  const ym = searchParams.ym && /^\d{4}-\d{2}$/.test(searchParams.ym)
    ? searchParams.ym
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [year, month] = ym.split("-").map(Number);

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { industryType: true }
  });
  if (!isCareCompany(company?.industryType)) redirect("/admin");

  const { start, end } = tokyoMonthRange(year, month);
  const dayCount = daysInMonth(year, month);

  const [rules, shifts] = await Promise.all([
    prisma.careStaffingRule.findMany({
      where: {
        companyId: session.user.companyId,
        category: { in: targetCategories.map((item) => item.category) },
        floorId: null,
        departmentId: null
      }
    }).catch(() => []),
    prisma.shift.findMany({
      where: { companyId: session.user.companyId, workDate: { gte: start, lt: end } },
      select: { workDate: true, workPattern: { select: { category: true } } }
    }).catch(() => [])
  ]);

  const requiredByCategory = new Map<WorkPatternCategory, number>();
  for (const item of targetCategories) requiredByCategory.set(item.category, 0);
  for (const rule of rules) requiredByCategory.set(rule.category, rule.requiredCount);

  const assigned = new Map<string, Map<WorkPatternCategory, number>>();
  const targetCategorySet = new Set<WorkPatternCategory>(targetCategories.map((item) => item.category));
  for (const shift of shifts) {
    const category = shift.workPattern?.category;
    if (!category || !targetCategorySet.has(category)) continue;
    const key = dateKey(shift.workDate);
    const perDate = assigned.get(key) ?? new Map<WorkPatternCategory, number>();
    perDate.set(category, (perDate.get(category) ?? 0) + 1);
    assigned.set(key, perDate);
  }

  const rows = Array.from({ length: dayCount }, (_, index) => {
    const day = index + 1;
    const date = new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+09:00`);
    const key = dateKey(date);
    const cells = targetCategories.map((item) => {
      const required = requiredByCategory.get(item.category) ?? 0;
      const assignedCount = assigned.get(key)?.get(item.category) ?? 0;
      return { category: item.category, label: item.label, required, assigned: assignedCount, ok: assignedCount >= required };
    });

    return {
      date: key,
      day,
      weekday: new Intl.DateTimeFormat("ja-JP", { weekday: "short", timeZone: "Asia/Tokyo" }).format(date),
      cells,
      ok: cells.every((cell) => cell.ok)
    };
  });

  const shortageDays = rows.filter((row) => !row.ok).length;
  const hasRules = rules.length > 0;

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="care-staffing" />
      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-emerald-700">介護施設モード</p>
              <h1 className="text-2xl font-black text-slate-900">人員配置表</h1>
              <p className="mt-1 text-sm text-slate-500">勤務区分ごとの必要人数と配置人数を月別に確認します。</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/admin/care/staffing?ym=${buildMonthNav(ym, -1)}`} className="rounded-xl border bg-white px-3 py-2 font-black text-slate-700">前月</Link>
              <div className="rounded-xl border bg-white px-4 py-2 font-black text-slate-900">{monthLabel(year, month)}</div>
              <Link href={`/admin/care/staffing?ym=${buildMonthNav(ym, 1)}`} className="rounded-xl border bg-white px-3 py-2 font-black text-slate-700">翌月</Link>
              <Link href="/admin/care/staffing-rules" className="rounded-xl bg-slate-900 px-4 py-2 font-black text-white">基準設定</Link>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-6">
          <div className="mb-5 grid gap-4 md:grid-cols-3">
            <SummaryCard label="対象月" value={monthLabel(year, month)} />
            <SummaryCard label="不足日数" value={`${shortageDays}日`} valueClassName={shortageDays > 0 ? "text-red-600" : "text-emerald-600"} />
            <SummaryCard label="基準設定" value={hasRules ? "設定済み" : "未設定"} valueClassName={hasRules ? "text-emerald-600" : "text-orange-600"} />
          </div>

          {!hasRules && (
            <div className="mb-5 rounded-3xl border border-orange-200 bg-orange-50 p-5 text-sm font-bold text-orange-800">
              人員配置基準が未設定です。必要人数を設定すると、不足判定を確認できます。
            </div>
          )}

          <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full min-w-[1080px] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 shadow-sm">
                  <tr>
                    <th className="border-b px-4 py-3 text-left font-black">日付</th>
                    {targetCategories.map((item) => (
                      <th key={item.category} className="border-b px-4 py-3 text-left font-black">{item.label}</th>
                    ))}
                    <th className="border-b px-4 py-3 text-left font-black">総合判定</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.date} className={row.ok ? "bg-white" : "bg-red-50"}>
                      <td className="border-b px-4 py-3 font-black text-slate-900">{row.day}日（{row.weekday}）</td>
                      {row.cells.map((cell) => (
                        <td key={cell.category} className="border-b px-4 py-3"><StaffingStatusCell cell={cell} /></td>
                      ))}
                      <td className="border-b px-4 py-3">
                        <StatusBadge ok={row.ok} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function SummaryCard({ label, value, valueClassName = "text-slate-900" }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-black ${valueClassName}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
      {ok ? "OK" : "不足"}
    </span>
  );
}

function StaffingStatusCell({ cell }: { cell: StaffingCell }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="font-black text-slate-900">必要 {cell.required} / 配置 {cell.assigned}</p>
        {cell.required > 0 && cell.assigned < cell.required && <p className="mt-1 text-xs font-bold text-red-600">不足 {cell.required - cell.assigned}名</p>}
      </div>
      <StatusBadge ok={cell.ok} />
    </div>
  );
}
