import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/components/RequireAuth";
import { AdminSidebar } from "@/components/AdminSidebar";
import { calcDailyWorkMinutes, formatJaTime, minutesToHHMM, toJaDateKey } from "@/lib/attendance";

type DayStatus = "OK" | "LATE" | "EARLY" | "MISSING" | "HOLIDAY" | "NO_SHIFT";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function parseTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function plannedMinutes(shift: { startTime: string; endTime: string; breakMinutes: number } | null) {
  if (!shift || (shift.startTime === "00:00" && shift.endTime === "00:00")) return 0;
  let minutes = parseTime(shift.endTime) - parseTime(shift.startTime) - shift.breakMinutes;
  if (minutes < 0) minutes += 24 * 60;
  return Math.max(0, minutes);
}

function statusLabel(status: DayStatus) {
  switch (status) {
    case "OK": return "正常";
    case "LATE": return "遅刻";
    case "EARLY": return "早退";
    case "MISSING": return "未打刻";
    case "HOLIDAY": return "休み";
    case "NO_SHIFT": return "予定なし";
  }
}

function statusClass(status: DayStatus) {
  switch (status) {
    case "OK": return "bg-green-50 text-green-700";
    case "LATE": return "bg-red-50 text-red-700";
    case "EARLY": return "bg-orange-50 text-orange-700";
    case "MISSING": return "bg-yellow-50 text-yellow-700";
    case "HOLIDAY": return "bg-slate-100 text-slate-500";
    case "NO_SHIFT": return "bg-slate-50 text-slate-400";
  }
}

export default async function EmployeeMonthlyPage({ searchParams }: { searchParams: { userId?: string; ym?: string } }) {
  const session = await requireAdmin();
  const now = new Date();
  const ym = searchParams.ym ?? `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const [year, month] = ym.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const dayCount = new Date(year, month, 0).getDate();

  const users = await prisma.user.findMany({
    where: { companyId: session.user.companyId },
    select: { id: true, name: true, department: true },
    orderBy: [{ department: "asc" }, { createdAt: "asc" }]
  });
  const selectedUserId = searchParams.userId ?? users[0]?.id ?? "";
  const selectedUser = users.find((user) => user.id === selectedUserId) ?? users[0] ?? null;

  const [shifts, logs] = selectedUser
    ? await Promise.all([
        prisma.shift.findMany({
          where: { companyId: session.user.companyId, userId: selectedUser.id, workDate: { gte: start, lt: end } },
          include: { workPattern: true },
          orderBy: { workDate: "asc" }
        }).catch(() => []),
        prisma.attendanceLog.findMany({
          where: { companyId: session.user.companyId, userId: selectedUser.id, stampedAt: { gte: start, lt: end } },
          orderBy: { stampedAt: "asc" }
        }).catch(() => [])
      ])
    : [[], []];

  const shiftByDate = new Map(shifts.map((shift) => [dateKey(shift.workDate.getFullYear(), shift.workDate.getMonth() + 1, shift.workDate.getDate()), shift]));
  const logsByDate = new Map<string, typeof logs>();
  for (const log of logs) {
    const key = toJaDateKey(log.stampedAt);
    logsByDate.set(key, [...(logsByDate.get(key) ?? []), log]);
  }

  const rows = Array.from({ length: dayCount }, (_, index) => {
    const day = index + 1;
    const key = dateKey(year, month, day);
    const shift = shiftByDate.get(key) ?? null;
    const dayLogs = logsByDate.get(key) ?? [];
    const clockIn = dayLogs.find((log) => log.type === "CLOCK_IN");
    const clockOut = [...dayLogs].reverse().find((log) => log.type === "CLOCK_OUT");
    const actualMinutes = calcDailyWorkMinutes(dayLogs);
    const scheduleMinutes = plannedMinutes(shift);
    const isHoliday = Boolean(shift?.workPattern?.isHoliday || (shift?.startTime === "00:00" && shift?.endTime === "00:00"));
    const lateMinutes = shift && clockIn ? Math.max(0, Number(formatJaTime(clockIn.stampedAt).slice(0, 2)) * 60 + Number(formatJaTime(clockIn.stampedAt).slice(3, 5)) - parseTime(shift.startTime)) : 0;
    const earlyMinutes = shift && clockOut ? Math.max(0, parseTime(shift.endTime) - (Number(formatJaTime(clockOut.stampedAt).slice(0, 2)) * 60 + Number(formatJaTime(clockOut.stampedAt).slice(3, 5)))) : 0;
    let status: DayStatus = "OK";
    if (!shift) status = "NO_SHIFT";
    else if (isHoliday) status = "HOLIDAY";
    else if (!clockIn || !clockOut) status = "MISSING";
    else if (lateMinutes > 0) status = "LATE";
    else if (earlyMinutes > 0) status = "EARLY";

    return { key, day, shift, dayLogs, clockIn, clockOut, actualMinutes, scheduleMinutes, lateMinutes, earlyMinutes, status };
  });

  const totalActual = rows.reduce((sum, row) => sum + row.actualMinutes, 0);
  const totalPlanned = rows.reduce((sum, row) => sum + row.scheduleMinutes, 0);
  const workDays = rows.filter((row) => row.actualMinutes > 0).length;
  const scheduledDays = rows.filter((row) => row.scheduleMinutes > 0).length;

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="monthly" />
      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-black">従業員別 月間明細</h1>
              <p className="text-sm text-slate-500">1ヶ月単位で予定と打刻実績を確認できます。</p>
            </div>
            <form className="flex flex-wrap items-center gap-2">
              <select name="userId" defaultValue={selectedUser?.id ?? ""} className="rounded-xl border px-4 py-2">
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
              <input name="ym" type="month" defaultValue={ym} className="rounded-xl border px-4 py-2" />
              <button className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white">表示</button>
            </form>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-6">
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <SummaryCard label="従業員" value={selectedUser?.name ?? "-"} />
            <SummaryCard label="予定日数" value={`${scheduledDays}日`} />
            <SummaryCard label="実勤務日数" value={`${workDays}日`} />
            <SummaryCard label="実勤務時間" value={minutesToHHMM(totalActual)} />
          </div>

          <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="text-lg font-black">{ym} 明細</h2>
                <p className="text-sm text-slate-500">予定時間 {minutesToHHMM(totalPlanned)} / 実績 {minutesToHHMM(totalActual)}</p>
              </div>
              <Link href={`/admin/monthly?ym=${ym}`} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
                月次集計へ
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="p-4">日付</th>
                    <th className="p-4">状態</th>
                    <th className="p-4">予定</th>
                    <th className="p-4">出勤</th>
                    <th className="p-4">退勤</th>
                    <th className="p-4">予定時間</th>
                    <th className="p-4">実勤務</th>
                    <th className="p-4">遅刻</th>
                    <th className="p-4">早退</th>
                    <th className="p-4">打刻数</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} className="border-t hover:bg-slate-50">
                      <td className="p-4 font-black">{row.key}</td>
                      <td className="p-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(row.status)}`}>
                          {statusLabel(row.status)}
                        </span>
                      </td>
                      <td className="p-4">{row.shift ? `${row.shift.patternCode ?? ""} ${row.shift.startTime}-${row.shift.endTime}` : "-"}</td>
                      <td className="p-4 font-bold">{row.clockIn ? formatJaTime(row.clockIn.stampedAt) : "-"}</td>
                      <td className="p-4 font-bold">{row.clockOut ? formatJaTime(row.clockOut.stampedAt) : "-"}</td>
                      <td className="p-4 font-bold">{minutesToHHMM(row.scheduleMinutes)}</td>
                      <td className="p-4 font-bold text-blue-700">{minutesToHHMM(row.actualMinutes)}</td>
                      <td className="p-4 font-bold text-red-700">{row.lateMinutes > 0 ? `${row.lateMinutes}分` : "-"}</td>
                      <td className="p-4 font-bold text-orange-700">{row.earlyMinutes > 0 ? `${row.earlyMinutes}分` : "-"}</td>
                      <td className="p-4">{row.dayLogs.length}</td>
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
      <p className="mt-3 text-2xl font-black text-blue-700">{value}</p>
    </div>
  );
}
