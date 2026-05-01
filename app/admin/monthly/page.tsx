import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/components/RequireAuth";
import { AdminSidebar } from "@/components/AdminSidebar";
import { calcDailyWorkMinutes, minutesToHHMM, toJaDateKey } from "@/lib/attendance";

export default async function MonthlyPage({ searchParams }: { searchParams: { ym?: string } }) {
  const session = await requireAdmin();
  const now = new Date();
  const ym = searchParams.ym ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [year, month] = ym.split("-").map(Number);

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const users = await prisma.user.findMany({
    where: { companyId: session.user.companyId },
    include: {
      attendanceLogs: {
        where: { stampedAt: { gte: start, lt: end } },
        orderBy: { stampedAt: "asc" }
      },
      paidLeaves: true
    }
  });

  const rows = users.map((user) => {
    const byDate = new Map<string, typeof user.attendanceLogs>();
    for (const log of user.attendanceLogs) {
      const key = toJaDateKey(log.stampedAt);
      byDate.set(key, [...(byDate.get(key) ?? []), log]);
    }
    let days = 0;
    let total = 0;
    byDate.forEach((logs) => {
      const min = calcDailyWorkMinutes(logs);
      if (min > 0) days += 1;
      total += min;
    });
    const overtime = Math.max(0, total - days * 8 * 60);
    const leave = user.paidLeaves[0];
    return { user, days, total, overtime, leaveRemain: leave ? leave.grantedDays - leave.usedDays : 0 };
  });

  const totalWorkMinutes = rows.reduce((sum, r) => sum + r.total, 0);
  const totalOvertime = rows.reduce((sum, r) => sum + r.overtime, 0);
  const totalDays = rows.reduce((sum, r) => sum + r.days, 0);

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="monthly" />

      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-black">月次勤怠集計</h1>
              <p className="text-sm text-slate-500">{ym} の勤怠集計</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <form className="flex gap-2">
                <input name="ym" type="month" defaultValue={ym} className="rounded-xl border px-4 py-2" />
                <button className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white">検索</button>
              </form>
              <Link className="rounded-xl bg-green-600 px-4 py-2 font-bold text-white" href={`/api/admin/monthly.csv?ym=${ym}`}>
                CSV出力
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-6">
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <SummaryCard label="総出勤日数" value={`${totalDays}日`} />
            <SummaryCard label="総労働時間" value={minutesToHHMM(totalWorkMinutes)} />
            <SummaryCard label="総残業時間" value={minutesToHHMM(totalOvertime)} />
          </div>

          <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="border-b p-5">
              <h2 className="text-lg font-black">社員別集計</h2>
              <p className="text-sm text-slate-500">給与ソフト連携用にCSV出力できます。</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[840px] text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="p-4">氏名</th>
                    <th className="p-4">所属</th>
                    <th className="p-4">出勤日数</th>
                    <th className="p-4">総労働時間</th>
                    <th className="p-4">残業時間</th>
                    <th className="p-4">有給残数</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.user.id} className="border-t hover:bg-slate-50">
                      <td className="p-4 font-black">{row.user.name}</td>
                      <td className="p-4">{row.user.department ?? "-"}</td>
                      <td className="p-4 font-bold">{row.days}日</td>
                      <td className="p-4 font-bold text-blue-700">{minutesToHHMM(row.total)}</td>
                      <td className="p-4 font-bold text-red-600">{minutesToHHMM(row.overtime)}</td>
                      <td className="p-4 font-bold">
                        <div>{row.leaveRemain}日</div>
                        <Link href={`/admin/employee-monthly?userId=${row.user.id}&ym=${ym}`} className="mt-2 inline-block text-xs font-black text-blue-700 underline">
                          明細
                        </Link>
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-black text-blue-700">{value}</p>
    </div>
  );
}
