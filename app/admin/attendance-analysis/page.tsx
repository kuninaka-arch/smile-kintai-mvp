import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/components/RequireAuth";
import { AdminSidebar } from "@/components/AdminSidebar";
import { minutesToHHMM, calcDailyWorkMinutes } from "@/lib/attendance";

type Status = "OK" | "LATE" | "EARLY" | "MISSING_IN" | "MISSING_OUT" | "NO_SHIFT";

function parseDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`);
}

function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function dateToMinutes(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function statusLabel(status: Status) {
  switch (status) {
    case "OK": return "正常";
    case "LATE": return "遅刻";
    case "EARLY": return "早退";
    case "MISSING_IN": return "出勤未打刻";
    case "MISSING_OUT": return "退勤未打刻";
    case "NO_SHIFT": return "シフトなし";
  }
}

function statusClass(status: Status) {
  switch (status) {
    case "OK": return "bg-green-50 text-green-700";
    case "LATE": return "bg-red-50 text-red-700";
    case "EARLY": return "bg-orange-50 text-orange-700";
    case "MISSING_IN": return "bg-red-50 text-red-700";
    case "MISSING_OUT": return "bg-yellow-50 text-yellow-700";
    case "NO_SHIFT": return "bg-slate-100 text-slate-500";
  }
}

export default async function AttendanceAnalysisPage({ searchParams }: { searchParams: { date?: string; grace?: string } }) {
  const session = await requireAdmin();
  const todayStr = new Date().toISOString().slice(0, 10);
  const dateStr = searchParams.date ?? todayStr;
  const graceMinutes = Number(searchParams.grace ?? 5);

  const targetStart = parseDate(dateStr);
  const targetEnd = new Date(targetStart);
  targetEnd.setDate(targetEnd.getDate() + 1);

  const users = await prisma.user.findMany({
    where: { companyId: session.user.companyId },
    include: {
      shifts: {
        where: { workDate: targetStart },
        include: { workPattern: true }
      },
      attendanceLogs: {
        where: { stampedAt: { gte: targetStart, lt: targetEnd } },
        orderBy: { stampedAt: "asc" }
      }
    },
    orderBy: [{ department: "asc" }, { createdAt: "asc" }]
  });

  const rows = users.map((user) => {
    const shift = user.shifts[0];
    const logs = user.attendanceLogs;
    const clockIn = logs.find((l) => l.type === "CLOCK_IN");
    const clockOut = [...logs].reverse().find((l) => l.type === "CLOCK_OUT");
    const workMinutes = calcDailyWorkMinutes(logs);

    let status: Status = "OK";
    let lateMinutes = 0;
    let earlyMinutes = 0;

    if (!shift) {
      status = "NO_SHIFT";
    } else if (shift.startTime === "00:00" && shift.endTime === "00:00") {
      status = "NO_SHIFT";
    } else if (!clockIn) {
      status = "MISSING_IN";
    } else if (!clockOut) {
      status = "MISSING_OUT";
      const scheduledStart = toMinutes(shift.startTime);
      lateMinutes = Math.max(0, dateToMinutes(clockIn.stampedAt) - scheduledStart);
      if (lateMinutes > graceMinutes) status = "LATE";
    } else {
      const scheduledStart = toMinutes(shift.startTime);
      const scheduledEnd = toMinutes(shift.endTime);
      const actualIn = dateToMinutes(clockIn.stampedAt);
      const actualOut = dateToMinutes(clockOut.stampedAt);

      lateMinutes = Math.max(0, actualIn - scheduledStart);
      earlyMinutes = Math.max(0, scheduledEnd - actualOut);

      if (lateMinutes > graceMinutes) status = "LATE";
      else if (earlyMinutes > graceMinutes) status = "EARLY";
      else status = "OK";
    }

    return {
      user,
      shift,
      clockIn,
      clockOut,
      workMinutes,
      status,
      lateMinutes,
      earlyMinutes
    };
  });

  const count = {
    ok: rows.filter((r) => r.status === "OK").length,
    late: rows.filter((r) => r.status === "LATE").length,
    early: rows.filter((r) => r.status === "EARLY").length,
    missingIn: rows.filter((r) => r.status === "MISSING_IN").length,
    missingOut: rows.filter((r) => r.status === "MISSING_OUT").length,
    noShift: rows.filter((r) => r.status === "NO_SHIFT").length
  };

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="attendance-analysis" />

      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-bold text-blue-700">商用版フェーズ3</p>
              <h1 className="text-2xl font-black">勤怠分析</h1>
              <p className="text-sm text-slate-500">シフトと実績を比較し、遅刻・早退・未打刻を自動判定します。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <form className="flex flex-wrap items-center gap-2">
                <input name="date" type="date" defaultValue={dateStr} className="rounded-xl border px-4 py-2" />
                <select name="grace" defaultValue={String(graceMinutes)} className="rounded-xl border px-4 py-2">
                  <option value="0">猶予0分</option>
                  <option value="5">猶予5分</option>
                  <option value="10">猶予10分</option>
                  <option value="15">猶予15分</option>
                </select>
                <button className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white">表示</button>
              </form>
              <Link
                href={`/api/admin/attendance-analysis.csv?date=${dateStr}&grace=${graceMinutes}`}
                className="rounded-xl bg-green-600 px-4 py-2 font-bold text-white"
              >
                CSV出力
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-6">
          <section className="mb-6 rounded-[2rem] bg-gradient-to-br from-slate-900 to-blue-700 p-6 text-white shadow-sm">
            <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
              <div>
                <p className="text-sm font-bold text-white/80">Shift vs Attendance</p>
                <h2 className="mt-2 text-3xl font-black">勤怠チェックを自動化</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
                  予定シフトと実績打刻を比較し、遅刻・早退・未打刻を自動で見える化します。
                </p>
              </div>
              <div className="rounded-3xl bg-white/15 p-4 backdrop-blur">
                <p className="text-sm text-white/80">対象日</p>
                <p className="mt-2 text-4xl font-black">{dateStr}</p>
                <p className="mt-2 text-sm text-white/70">判定猶予：{graceMinutes}分</p>
              </div>
            </div>
          </section>

          <div className="mb-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <Kpi label="正常" value={`${count.ok}名`} color="text-green-700" />
            <Kpi label="遅刻" value={`${count.late}名`} color="text-red-700" />
            <Kpi label="早退" value={`${count.early}名`} color="text-orange-700" />
            <Kpi label="出勤未打刻" value={`${count.missingIn}名`} color="text-red-700" />
            <Kpi label="退勤未打刻" value={`${count.missingOut}名`} color="text-yellow-700" />
            <Kpi label="シフトなし" value={`${count.noShift}名`} color="text-slate-700" />
          </div>

          <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="text-lg font-black">社員別 勤怠判定</h2>
                <p className="text-sm text-slate-500">予定時刻と実績時刻を比較します。</p>
              </div>
              <Link href="/admin/shifts" className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
                シフト設定へ
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="p-4">社員</th>
                    <th className="p-4">所属</th>
                    <th className="p-4">判定</th>
                    <th className="p-4">予定</th>
                    <th className="p-4">出勤実績</th>
                    <th className="p-4">退勤実績</th>
                    <th className="p-4">実働</th>
                    <th className="p-4">遅刻</th>
                    <th className="p-4">早退</th>
                    <th className="p-4">GPS</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.user.id} className="border-t hover:bg-slate-50">
                      <td className="p-4 font-black">{row.user.name}</td>
                      <td className="p-4">{row.user.department ?? "-"}</td>
                      <td className="p-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(row.status)}`}>
                          {statusLabel(row.status)}
                        </span>
                      </td>
                      <td className="p-4">
                        {row.shift ? `${row.shift.startTime}〜${row.shift.endTime}` : "-"}
                      </td>
                      <td className="p-4 font-bold">
                        {row.clockIn ? row.clockIn.stampedAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : "-"}
                      </td>
                      <td className="p-4 font-bold">
                        {row.clockOut ? row.clockOut.stampedAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : "-"}
                      </td>
                      <td className="p-4 font-bold text-blue-700">{minutesToHHMM(row.workMinutes)}</td>
                      <td className="p-4 font-bold text-red-700">{row.lateMinutes > 0 ? `${row.lateMinutes}分` : "-"}</td>
                      <td className="p-4 font-bold text-orange-700">{row.earlyMinutes > 0 ? `${row.earlyMinutes}分` : "-"}</td>
                      <td className="p-4">
                        {row.clockIn?.latitude ? (
                          <a
                            className="text-xs font-bold text-blue-700 underline"
                            href={`https://www.google.com/maps?q=${row.clockIn.latitude},${row.clockIn.longitude}`}
                            target="_blank"
                          >
                            地図
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">なし</span>
                        )}
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

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className={`mt-3 text-3xl font-black ${color}`}>{value}</p>
    </div>
  );
}
