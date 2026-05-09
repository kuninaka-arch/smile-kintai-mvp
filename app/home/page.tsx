import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/components/RequireAuth";
import { PunchButtons } from "@/components/PunchButtons";
import { minutesToHHMM, calcDailyWorkMinutes, formatJaDate, formatJaTime } from "@/lib/attendance";
import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";

export default async function HomePage() {
  const totalStart = Date.now();
  console.log("[PERF][home] total:start");

  const authStart = Date.now();
  const session = await requireAuth();
  console.log("[PERF][home] auth-session", Date.now() - authStart, "ms");

  const userStart = Date.now();
  const isAdmin = session.user.role === "ADMIN";
  console.log("[PERF][home] load-user", Date.now() - userStart, "ms");

  const renderPrepStart = Date.now();
  const { key: todayKey, start: todayStart, end: todayEnd } = todayTokyoRange();
  const monthStart = new Date(`${todayKey.slice(0, 7)}-01T00:00:00+09:00`);
  console.log("[PERF][home] render-prep", Date.now() - renderPrepStart, "ms");

  const todayAttendanceStart = Date.now();
  const logs = await prisma.attendanceLog.findMany({
    where: {
      companyId: session.user.companyId,
      userId: session.user.id,
      stampedAt: { gte: todayStart, lt: todayEnd }
    },
    orderBy: { stampedAt: "asc" }
  });
  console.log("[PERF][home] load-today-attendance", Date.now() - todayAttendanceStart, "ms");

  const monthAttendanceStart = Date.now();
  const monthLogs = await prisma.attendanceLog.findMany({
    where: {
      companyId: session.user.companyId,
      userId: session.user.id,
      stampedAt: { gte: monthStart, lt: todayEnd },
      type: "CLOCK_IN"
    }
  });
  console.log("[PERF][home] load-month-attendance", Date.now() - monthAttendanceStart, "ms");

  const paidLeaveStart = Date.now();
  const paidLeave = await prisma.paidLeave.findFirst({
    where: { companyId: session.user.companyId, userId: session.user.id }
  });
  console.log("[PERF][home] load-paid-leave", Date.now() - paidLeaveStart, "ms");

  const shiftStart = Date.now();
  const shift = await prisma.shift.findFirst({
    where: {
      companyId: session.user.companyId,
      userId: session.user.id,
      workDate: { gte: todayStart, lt: todayEnd }
    },
    include: {
      workPattern: {
        select: {
          name: true,
          category: true,
          isHoliday: true
        }
      }
    }
  });
  console.log("[PERF][home] load-today-shift", Date.now() - shiftStart, "ms");
  const todayShiftText = formatTodayShift(shift);

  const latest = logs[logs.length - 1];
  const status =
    latest?.type === "CLOCK_IN" || latest?.type === "BREAK_END"
      ? "勤務中"
      : latest?.type === "BREAK_START"
      ? "休憩中"
      : latest?.type === "CLOCK_OUT"
      ? "退勤済み"
      : "未打刻";

  console.log("[PERF][home] total", Date.now() - totalStart, "ms");

  return (
    <main className="min-h-screen bg-slate-100 pb-24">
      <header className="bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 px-5 pb-8 pt-5 text-white">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between">
            <Link href="/post-login" className="text-lg font-black">☺ 勤怠管理システム</Link>
            <div className="flex items-center gap-2">
              <Link href="/history" className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
                履歴
              </Link>
              <SignOutButton />
            </div>
          </div>

          <div className="mt-8 rounded-3xl bg-white/15 p-5 shadow-lg backdrop-blur">
            <p className="text-sm opacity-90">おはようございます</p>
            <h1 className="mt-1 text-3xl font-black">{session.user.name}さん</h1>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-white/15 p-3">
                <p className="opacity-80">本日のシフト</p>
                <p className="font-bold">{todayShiftText}</p>
              </div>
              <div className="rounded-2xl bg-white/15 p-3">
                <p className="opacity-80">現在の状態</p>
                <p className="font-bold">{status}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto -mt-5 max-w-md px-5">
        <PunchButtons />

        <div className="mt-5 grid grid-cols-3 gap-3">
          <InfoCard label="実働時間" value={minutesToHHMM(calcDailyWorkMinutes(logs))} />
          <InfoCard label="今月出勤" value={`${monthLogs.length}日`} />
          <InfoCard label="有給残数" value={`${paidLeave ? paidLeave.grantedDays - paidLeave.usedDays : 0}日`} />
        </div>

        <div className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-black">今日の打刻</h2>
            <span className="text-xs text-slate-400">{formatJaDate(new Date())}</span>
          </div>
          <div className="space-y-3">
            {logs.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-500">
                まだ打刻がありません
              </p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                  <div>
                    <p className="font-bold">
                      {log.type === "CLOCK_IN"
                        ? "出勤"
                        : log.type === "CLOCK_OUT"
                        ? "退勤"
                        : log.type === "BREAK_START"
                        ? "休憩開始"
                        : "休憩終了"}
                    </p>
                    <p className="text-xs text-slate-400">{log.latitude ? "GPS取得済み" : "GPSなし"}</p>
                  </div>
                  <p className="text-lg font-black">
                    {formatJaTime(log.stampedAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <BottomNav isAdmin={isAdmin} />
    </main>
  );
}

function todayTokyoRange() {
  const key = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
  const start = new Date(`${key}T00:00:00+09:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { key, start, end };
}

function formatTodayShift(
  shift: {
    startTime: string;
    endTime: string;
    patternCode: string | null;
    workPattern: { name: string; category: string; isHoliday: boolean } | null;
  } | null
) {
  if (!shift) return "未設定";
  if (shift.workPattern?.isHoliday || shift.workPattern?.category === "OFF") return "休み";

  const label = shift.workPattern?.name ?? shift.patternCode ?? "シフト";
  return `${label} ${shift.startTime}〜${shift.endTime}`;
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white p-4 text-center shadow-sm">
      <p className="text-xs font-bold text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-black text-blue-700">{value}</p>
    </div>
  );
}

function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t bg-white/95 backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-5 px-2 py-2 text-center text-xs font-bold text-slate-500">
        <Link className="rounded-2xl bg-blue-50 py-2 text-blue-700" href="/home">ホーム</Link>
        <Link className="py-2" href="/history">履歴</Link>
        <Link className="py-2" href="/leaves">休暇</Link>
        <Link className="py-2" href="/corrections">申請</Link>
        {isAdmin ? <Link className="py-2" href="/admin">管理</Link> : <Link className="py-2" href="/api/auth/signout">ログアウト</Link>}
      </div>
    </nav>
  );
}
