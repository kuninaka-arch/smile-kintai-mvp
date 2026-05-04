import Link from "next/link";
import { redirect } from "next/navigation";
import { WorkPatternCategory } from "@prisma/client";
import { AdminSidebar } from "@/components/AdminSidebar";
import { CareQualificationsManager } from "@/components/CareQualificationsManager";
import { requireAdmin } from "@/components/RequireAuth";
import { isCareCompany } from "@/lib/industry";
import { prisma } from "@/lib/prisma";

const workCategories = new Set<WorkPatternCategory>([
  WorkPatternCategory.EARLY,
  WorkPatternCategory.DAY,
  WorkPatternCategory.LATE,
  WorkPatternCategory.NIGHT
]);

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

export default async function CareQualificationsPage({ searchParams }: { searchParams: { ym?: string } }) {
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
  const [qualifications, users, shifts] = await Promise.all([
    prisma.qualificationMaster.findMany({
      where: { companyId: session.user.companyId },
      include: { careQualificationRules: true },
      orderBy: [{ name: "asc" }, { createdAt: "asc" }]
    }),
    prisma.user.findMany({
      where: { companyId: session.user.companyId },
      select: {
        id: true,
        name: true,
        department: true,
        displayOrder: true,
        createdAt: true,
        qualifications: {
          include: { qualification: true },
          orderBy: { createdAt: "asc" }
        }
      },
      orderBy: [{ department: "asc" }, { displayOrder: "asc" }, { createdAt: "asc" }]
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
            qualifications: { include: { qualification: true } }
          }
        },
        workPattern: { select: { category: true } }
      }
    })
  ]);

  const qualificationRows = qualifications.map((qualification) => ({
    id: qualification.id,
    name: qualification.name,
    requiredCount: qualification.careQualificationRules[0]?.requiredCount ?? 0
  }));

  const userRows = users.map((user) => ({
    id: user.id,
    name: user.name,
    department: user.department,
    qualifications: user.qualifications.map((item) => ({
      id: item.id,
      qualificationId: item.qualificationId,
      name: item.qualification.name
    }))
  }));

  const assignedByDateAndQualification = new Map<string, Map<string, Map<string, string>>>();
  for (const shift of shifts) {
    const category = shift.workPattern?.category;
    if (!category || !workCategories.has(category)) continue;

    const key = dateKey(shift.workDate);
    const perDate = assignedByDateAndQualification.get(key) ?? new Map<string, Map<string, string>>();

    for (const userQualification of shift.user.qualifications) {
      const staffByQualification = perDate.get(userQualification.qualificationId) ?? new Map<string, string>();
      staffByQualification.set(shift.user.id, shift.user.name);
      perDate.set(userQualification.qualificationId, staffByQualification);
    }

    assignedByDateAndQualification.set(key, perDate);
  }

  const dayCount = daysInMonth(year, month);
  const staffingRows = Array.from({ length: dayCount }, (_, index) => {
    const day = index + 1;
    const date = new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+09:00`);
    const key = dateKey(date);
    const perDate = assignedByDateAndQualification.get(key) ?? new Map<string, Map<string, string>>();
    const cells = qualificationRows.map((qualification) => {
      const staff = Array.from(perDate.get(qualification.id)?.values() ?? []);
      return {
        qualificationId: qualification.id,
        qualificationName: qualification.name,
        requiredCount: qualification.requiredCount,
        assignedCount: staff.length,
        staff,
        ok: staff.length >= qualification.requiredCount
      };
    });

    return {
      date: key,
      day,
      weekday: new Intl.DateTimeFormat("ja-JP", { weekday: "short", timeZone: "Asia/Tokyo" }).format(date),
      cells,
      ok: cells.every((cell) => cell.ok)
    };
  });

  const shortageCount = staffingRows.reduce((sum, row) => sum + row.cells.filter((cell) => !cell.ok).length, 0);

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="care-qualifications" />

      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-emerald-700">介護施設モード</p>
              <h1 className="text-2xl font-black text-slate-900">資格者配置表</h1>
              <p className="mt-1 text-sm text-slate-500">
                資格マスタ・スタッフ保有資格・資格別必要人数を管理し、月別に配置状況を確認します。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/admin/care/qualifications?ym=${buildMonthNav(ym, -1)}`} className="rounded-xl border bg-white px-3 py-2 font-black text-slate-700">
                前月
              </Link>
              <div className="rounded-xl border bg-white px-4 py-2 font-black text-slate-900">{monthLabel(year, month)}</div>
              <Link href={`/admin/care/qualifications?ym=${buildMonthNav(ym, 1)}`} className="rounded-xl border bg-white px-3 py-2 font-black text-slate-700">
                翌月
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-6 px-5 py-6">
          <CareQualificationsManager qualifications={qualificationRows} users={userRows} />

          <div className="grid gap-4 md:grid-cols-3">
            <SummaryCard label="対象月" value={monthLabel(year, month)} />
            <SummaryCard label="登録資格数" value={`${qualificationRows.length}件`} />
            <SummaryCard label="不足判定" value={`${shortageCount}件`} danger={shortageCount > 0} />
          </div>

          <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="border-b p-5">
              <h2 className="text-lg font-black text-slate-900">月別 資格者配置状況</h2>
              <p className="text-sm text-slate-500">
                早番・日勤・遅番・夜勤のシフトに入っているスタッフの保有資格を集計します。
              </p>
            </div>
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full min-w-[1180px] text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="sticky left-0 z-20 bg-slate-50 p-4 shadow-[1px_0_0_#e2e8f0]">日付</th>
                    <th className="p-4">資格名</th>
                    <th className="p-4">必要人数</th>
                    <th className="p-4">配置人数</th>
                    <th className="p-4">配置スタッフ</th>
                    <th className="p-4">判定</th>
                  </tr>
                </thead>
                <tbody>
                  {staffingRows.flatMap((row) =>
                    row.cells.map((cell, cellIndex) => (
                      <tr key={`${row.date}-${cell.qualificationId}`} className={!cell.ok ? "bg-red-50" : "bg-white"}>
                        {cellIndex === 0 && (
                          <td rowSpan={row.cells.length} className="sticky left-0 z-10 border-t bg-white p-4 font-black shadow-[1px_0_0_#e2e8f0]">
                            {row.day}日（{row.weekday}）
                          </td>
                        )}
                        <td className="border-t p-4 font-black text-slate-900">{cell.qualificationName}</td>
                        <td className="border-t p-4 font-bold">{cell.requiredCount}名</td>
                        <td className="border-t p-4 font-bold">{cell.assignedCount}名</td>
                        <td className="border-t p-4 text-slate-600">{cell.staff.length > 0 ? cell.staff.join("、") : "-"}</td>
                        <td className="border-t p-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-black ${cell.ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                            {cell.ok ? "OK" : "不足"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                  {qualificationRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center font-bold text-slate-500">
                        資格マスタを登録すると、配置状況を確認できます。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
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
