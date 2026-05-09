import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/components/RequireAuth";
import { Nav } from "@/components/Nav";
import { calcDailyWorkMinutes, formatJaDate, formatJaTime, minutesToHHMM, toJaDateKey, typeLabel } from "@/lib/attendance";

const weekdayFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  weekday: "short"
});

const requestTypeLabels: Record<string, string> = {
  ATTENDANCE_CORRECTION: "打刻修正",
  OVERTIME: "残業",
  HOLIDAY_WORK: "休日出勤",
  NIGHT_WORK: "深夜勤務",
  PAID_LEAVE: "有休",
  SUBSTITUTE_LEAVE: "代休",
  MATERNITY_LEAVE: "産休",
  CHILDCARE_LEAVE: "育休",
  SHORT_TIME_WORK: "時短勤務"
};

const statusLabels: Record<string, string> = {
  DRAFT: "下書き",
  PENDING: "申請中",
  APPROVED: "承認済み",
  REJECTED: "却下",
  RETURNED: "差戻し",
  CANCELED: "取消",
  CANCELLED: "取消"
};

export default async function HistoryPage() {
  const session = await requireAuth();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const historyStart = new Date(todayStart);
  historyStart.setDate(historyStart.getDate() - 30);

  const [logs, shifts, attendanceRequests, correctionRequests, leaveRequests] = await Promise.all([
    prisma.attendanceLog.findMany({
      where: {
        companyId: session.user.companyId,
        userId: session.user.id,
        stampedAt: { gte: historyStart, lt: tomorrowStart }
      },
      orderBy: { stampedAt: "asc" }
    }),
    prisma.shift.findMany({
      where: {
        companyId: session.user.companyId,
        userId: session.user.id,
        workDate: { gte: historyStart, lt: tomorrowStart }
      },
      include: {
        workPattern: {
          select: {
            name: true,
            category: true,
            isHoliday: true
          }
        }
      },
      orderBy: { workDate: "desc" }
    }),
    prisma.attendanceRequest.findMany({
      where: {
        companyId: session.user.companyId,
        userId: session.user.id,
        targetDate: { gte: historyStart, lt: tomorrowStart }
      },
      select: {
        id: true,
        requestType: true,
        status: true,
        targetDate: true,
        title: true
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.attendanceCorrectionRequest.findMany({
      where: {
        companyId: session.user.companyId,
        userId: session.user.id,
        targetDate: { gte: historyStart, lt: tomorrowStart }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.leaveRequest.findMany({
      where: {
        companyId: session.user.companyId,
        userId: session.user.id,
        targetDate: { gte: historyStart, lt: tomorrowStart }
      },
      include: {
        leaveType: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const logsByDate = groupByDate(logs, (log) => toJaDateKey(log.stampedAt));
  const shiftByDate = new Map(shifts.map((shift) => [toJaDateKey(shift.workDate), shift]));
  const requestsByDate = groupByDate(attendanceRequests, (request) => (request.targetDate ? toJaDateKey(request.targetDate) : ""));
  const correctionsByDate = groupByDate(correctionRequests, (request) => toJaDateKey(request.targetDate));
  const leavesByDate = groupByDate(leaveRequests, (request) => toJaDateKey(request.targetDate));

  const days = Array.from({ length: 31 }, (_, index) => {
    const date = new Date(todayStart);
    date.setDate(todayStart.getDate() - index);
    const key = toJaDateKey(date);
    const dayLogs = logsByDate.get(key) ?? [];
    const clockIn = dayLogs.find((log) => log.type === "CLOCK_IN");
    const clockOut = [...dayLogs].reverse().find((log) => log.type === "CLOCK_OUT");
    const breakMinutes = calcBreakMinutes(dayLogs);
    const workMinutes = calcDailyWorkMinutes(dayLogs);
    const shift = shiftByDate.get(key) ?? null;
    const badges = [
      ...(leavesByDate.get(key) ?? []).map((leave) => `${leave.leaveType.name}: ${statusLabels[leave.status] ?? leave.status}`),
      ...(correctionsByDate.get(key) ?? []).map((request) => `打刻修正: ${statusLabels[request.status] ?? request.status}`),
      ...(requestsByDate.get(key) ?? []).map((request) => `${requestTypeLabels[request.requestType] ?? request.requestType}: ${statusLabels[request.status] ?? request.status}`)
    ];

    return {
      key,
      date,
      dayLogs,
      clockIn,
      clockOut,
      breakMinutes,
      workMinutes,
      shift,
      badges
    };
  });

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-5">
          <h1 className="text-2xl font-black">打刻履歴</h1>
          <p className="mt-1 text-sm font-bold text-slate-500">直近31日分を日付単位で表示しています。</p>
        </div>

        <div className="space-y-3">
          {days.map((day) => (
            <section key={day.key} className="rounded-3xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-slate-900">
                    {formatJaDate(day.date)}
                    <span className="ml-2 text-sm text-slate-500">({weekdayFormatter.format(day.date)})</span>
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-500">シフト: {formatShift(day.shift)}</p>
                </div>
                <div className="text-right text-sm font-black text-blue-700">
                  <p>{minutesToHHMM(day.workMinutes)}</p>
                  <p className="text-xs text-slate-400">勤務時間</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                <HistoryMetric label="出勤" value={day.clockIn ? formatJaTime(day.clockIn.stampedAt) : "-"} />
                <HistoryMetric label="退勤" value={day.clockOut ? formatJaTime(day.clockOut.stampedAt) : "-"} />
                <HistoryMetric label="休憩" value={minutesToHHMM(day.breakMinutes)} />
                <HistoryMetric label="打刻数" value={`${day.dayLogs.length}件`} />
              </div>

              {day.badges.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {day.badges.map((badge) => (
                    <span key={badge} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                      {badge}
                    </span>
                  ))}
                </div>
              )}

              {day.dayLogs.length > 0 && (
                <div className="mt-4 divide-y rounded-2xl bg-slate-50">
                  {day.dayLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <div>
                        <p className="font-bold">{typeLabel(log.type)}</p>
                        <p className="text-xs text-slate-500">{log.latitude ? "GPSあり" : "GPSなし"}</p>
                      </div>
                      <p className="font-black">{formatJaTime(log.stampedAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </main>
    </>
  );
}

function HistoryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs font-bold text-slate-400">{label}</p>
      <p className="mt-1 font-black text-slate-900">{value}</p>
    </div>
  );
}

function groupByDate<T>(items: T[], getKey: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    if (!key) continue;
    const group = map.get(key) ?? [];
    group.push(item);
    map.set(key, group);
  }
  return map;
}

function calcBreakMinutes(logs: { type: string; stampedAt: Date }[]) {
  let breakMinutes = 0;
  let breakStart: Date | null = null;

  for (const log of logs) {
    if (log.type === "BREAK_START") breakStart = log.stampedAt;
    if (log.type === "BREAK_END" && breakStart) {
      breakMinutes += Math.max(0, Math.round((log.stampedAt.getTime() - breakStart.getTime()) / 60000));
      breakStart = null;
    }
  }

  return breakMinutes;
}

function formatShift(
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
