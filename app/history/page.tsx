import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/components/RequireAuth";
import { Nav } from "@/components/Nav";
import { formatJaDate, formatJaTime, minutesToHHMM, toJaDateKey, typeLabel } from "@/lib/attendance";
import type { AttendanceType } from "@prisma/client";

const weekdayFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  weekday: "short"
});

const summaryMonthLimit = 12;

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
  RETURNED: "差し戻し",
  CANCELED: "取消",
  CANCELLED: "取消"
};

type HistoryLog = {
  id: string;
  type: string;
  stampedAt: Date;
  latitude?: number | null;
};

export default async function HistoryPage({
  searchParams
}: {
  searchParams?: { ym?: string };
}) {
  const totalStart = Date.now();
  console.log("[PERF][history] total:start");

  const authStart = Date.now();
  const session = await requireAuth();
  console.log("[PERF][history] auth-session", Date.now() - authStart, "ms");

  const renderPrepStart = Date.now();
  const currentYm = currentTokyoMonth();
  const selectedYm = normalizeYm(searchParams?.ym) ?? currentYm;
  console.log("[PERF][history] render-prep", Date.now() - renderPrepStart, "ms");

  const availableMonthsStart = Date.now();
  const availableMonths = await loadAvailableMonths(session.user.companyId, session.user.id, currentYm, selectedYm);
  console.log("[PERF][history] load-available-months", Date.now() - availableMonthsStart, "ms");

  const summaryPrepStart = Date.now();
  const months = buildSummaryMonths(availableMonths, selectedYm, currentYm);
  console.log("[PERF][history] summary-range-prep", Date.now() - summaryPrepStart, "ms");

  const detailStart = Date.now();
  const detailPromise = loadMonthDetail(session.user.companyId, session.user.id, selectedYm).then((result) => {
    console.log("[PERF][history] load-month-detail", Date.now() - detailStart, "ms");
    return result;
  });
  const summariesStart = Date.now();
  const summariesPromise = loadMonthSummaries(session.user.companyId, session.user.id, months).then((result) => {
    console.log("[PERF][history] load-month-summaries", Date.now() - summariesStart, "ms");
    return result;
  });
  const [monthSummaries, monthDetail] = await Promise.all([
    summariesPromise,
    detailPromise
  ]);
  console.log("[PERF][history] total", Date.now() - totalStart, "ms");

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5">
          <h1 className="text-2xl font-black">勤怠履歴</h1>
          <p className="mt-1 text-sm font-bold text-slate-500">月を選択して、日別の出勤・退勤・申請状況を確認できます。</p>
        </div>

        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">月次一覧</h2>
              <p className="mt-1 text-sm text-slate-500">明細がある月を一覧表示しています。</p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
              選択中: {selectedYm}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="p-3">対象年月</th>
                  <th className="p-3">出勤日数</th>
                  <th className="p-3">勤務時間合計</th>
                  <th className="p-3">休憩時間合計</th>
                  <th className="p-3">申請中件数</th>
                  <th className="p-3">承認済み件数</th>
                  <th className="p-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {monthSummaries.map((summary) => (
                  <tr key={summary.ym} className={`border-t ${summary.ym === selectedYm ? "bg-blue-50/50" : ""}`}>
                    <td className="p-3 font-black">{summary.ym}</td>
                    <td className="p-3">{summary.workDays}日</td>
                    <td className="p-3">{minutesToHHMM(summary.workMinutes)}</td>
                    <td className="p-3">{minutesToHHMM(summary.breakMinutes)}</td>
                    <td className="p-3">{summary.pendingCount}件</td>
                    <td className="p-3">{summary.approvedCount}件</td>
                    <td className="p-3">
                      <Link
                        href={`/history?ym=${summary.ym}`}
                        className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white"
                      >
                        明細を見る
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">{selectedYm} 日別明細</h2>
              <p className="mt-1 text-sm text-slate-500">従業員本人の履歴のみ表示しています。</p>
            </div>
          </div>

          <div className="space-y-3">
            {monthDetail.days.map((day) => (
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
                          <p className="font-bold">{typeLabel(log.type as AttendanceType)}</p>
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
        </section>
      </main>
    </>
  );
}

async function loadAvailableMonths(companyId: string, userId: string, currentYm: string, selectedYm: string) {
  const { start: recentStart } = monthRange(addMonths(currentYm, -(summaryMonthLimit - 1)));
  const { end: recentEnd } = monthRange(currentYm);
  const { start: selectedStart, end: selectedEnd } = monthRange(selectedYm);
  const rows = await prisma.$queryRaw<{ ym: string }[]>`
    select ym
    from (
      select distinct to_char("stampedAt" at time zone 'Asia/Tokyo', 'YYYY-MM') as ym
      from "AttendanceLog"
      where "companyId" = ${companyId} and "userId" = ${userId}
        and (
          ("stampedAt" >= ${recentStart} and "stampedAt" < ${recentEnd})
          or ("stampedAt" >= ${selectedStart} and "stampedAt" < ${selectedEnd})
        )
      union
      select distinct to_char("workDate" at time zone 'Asia/Tokyo', 'YYYY-MM') as ym
      from "Shift"
      where "companyId" = ${companyId} and "userId" = ${userId}
        and (
          ("workDate" >= ${recentStart} and "workDate" < ${recentEnd})
          or ("workDate" >= ${selectedStart} and "workDate" < ${selectedEnd})
        )
      union
      select distinct to_char("targetDate" at time zone 'Asia/Tokyo', 'YYYY-MM') as ym
      from "AttendanceRequest"
      where "companyId" = ${companyId} and "userId" = ${userId} and "targetDate" is not null
        and (
          ("targetDate" >= ${recentStart} and "targetDate" < ${recentEnd})
          or ("targetDate" >= ${selectedStart} and "targetDate" < ${selectedEnd})
        )
      union
      select distinct to_char("targetDate" at time zone 'Asia/Tokyo', 'YYYY-MM') as ym
      from "AttendanceCorrectionRequest"
      where "companyId" = ${companyId} and "userId" = ${userId}
        and (
          ("targetDate" >= ${recentStart} and "targetDate" < ${recentEnd})
          or ("targetDate" >= ${selectedStart} and "targetDate" < ${selectedEnd})
        )
      union
      select distinct to_char("targetDate" at time zone 'Asia/Tokyo', 'YYYY-MM') as ym
      from "LeaveRequest"
      where "companyId" = ${companyId} and "userId" = ${userId}
        and (
          ("targetDate" >= ${recentStart} and "targetDate" < ${recentEnd})
          or ("targetDate" >= ${selectedStart} and "targetDate" < ${selectedEnd})
        )
    ) month_rows
    where ym is not null
    order by ym desc
  `;
  return rows.map((row) => row.ym).filter(Boolean);
}

type MonthSummary = {
  ym: string;
  workDays: number;
  workMinutes: number;
  breakMinutes: number;
  pendingCount: number;
  approvedCount: number;
};

async function loadMonthSummaries(companyId: string, userId: string, months: string[]) {
  if (months.length === 0) return [];

  const stampedAtFilters = months.map((ym) => {
    const { start, end } = monthRange(ym);
    return { stampedAt: { gte: start, lt: end } };
  });
  const targetDateFilters = months.map((ym) => {
    const { start, end } = monthRange(ym);
    return { targetDate: { gte: start, lt: end } };
  });
  const monthSet = new Set(months);
  const summaries = new Map(months.map((ym) => [ym, createMonthSummary(ym)]));

  const summaryLogsStart = Date.now();
  const summaryAttendanceRequestsStart = Date.now();
  const summaryCorrectionRequestsStart = Date.now();
  const summaryLeaveRequestsStart = Date.now();
  const [logs, attendanceRequests, correctionRequests, leaveRequests] = await Promise.all([
    prisma.attendanceLog.findMany({
      where: { companyId, userId, OR: stampedAtFilters },
      select: { type: true, stampedAt: true },
      orderBy: { stampedAt: "asc" }
    }).then((result) => {
      console.log("[PERF][history] history-summary-attendance-logs", Date.now() - summaryLogsStart, "ms");
      return result;
    }),
    prisma.attendanceRequest.findMany({
      where: { companyId, userId, OR: targetDateFilters },
      select: { status: true, targetDate: true }
    }).then((result) => {
      console.log("[PERF][history] history-summary-attendance-requests", Date.now() - summaryAttendanceRequestsStart, "ms");
      return result;
    }),
    prisma.attendanceCorrectionRequest.findMany({
      where: { companyId, userId, OR: targetDateFilters },
      select: { status: true, targetDate: true }
    }).then((result) => {
      console.log("[PERF][history] history-summary-correction-requests", Date.now() - summaryCorrectionRequestsStart, "ms");
      return result;
    }),
    prisma.leaveRequest.findMany({
      where: { companyId, userId, OR: targetDateFilters },
      select: { status: true, targetDate: true }
    }).then((result) => {
      console.log("[PERF][history] history-summary-leave-requests", Date.now() - summaryLeaveRequestsStart, "ms");
      return result;
    })
  ]);

  const summaryAggregateStart = Date.now();
  const logsByMonthDate = new Map<string, { type: string; stampedAt: Date }[]>();
  for (const log of logs) {
    const ym = toJaMonthKey(log.stampedAt);
    if (!monthSet.has(ym)) continue;
    const key = `${ym}:${toJaDateKey(log.stampedAt)}`;
    logsByMonthDate.set(key, [...(logsByMonthDate.get(key) ?? []), log]);
  }

  for (const [key, dayLogs] of Array.from(logsByMonthDate.entries())) {
    const ym = key.slice(0, 7);
    const summary = summaries.get(ym);
    if (!summary) continue;
    if (dayLogs.some((log) => log.type === "CLOCK_IN")) summary.workDays += 1;
    summary.workMinutes += calcWorkMinutes(dayLogs);
    summary.breakMinutes += calcBreakMinutes(dayLogs);
  }

  for (const request of attendanceRequests) addStatusCount(summaries, request.targetDate, request.status);
  for (const request of correctionRequests) addStatusCount(summaries, request.targetDate, request.status);
  for (const request of leaveRequests) addStatusCount(summaries, request.targetDate, request.status);
  console.log("[PERF][history] history-summary-aggregate", Date.now() - summaryAggregateStart, "ms");

  return months.map((ym) => summaries.get(ym) ?? createMonthSummary(ym));
}

async function loadMonthDetail(companyId: string, userId: string, ym: string) {
  const { start, end, dates } = monthRange(ym);
  const detailLogsStart = Date.now();
  const detailShiftsStart = Date.now();
  const detailAttendanceRequestsStart = Date.now();
  const detailCorrectionRequestsStart = Date.now();
  const detailLeaveRequestsStart = Date.now();
  const [logs, shifts, attendanceRequests, correctionRequests, leaveRequests] = await Promise.all([
    prisma.attendanceLog.findMany({
      where: { companyId, userId, stampedAt: { gte: start, lt: end } },
      select: { id: true, type: true, stampedAt: true, latitude: true },
      orderBy: { stampedAt: "asc" }
    }).then((result) => {
      console.log("[PERF][history] history-detail-attendance-logs", Date.now() - detailLogsStart, "ms");
      return result;
    }),
    prisma.shift.findMany({
      where: { companyId, userId, workDate: { gte: start, lt: end } },
      select: {
        workDate: true,
        startTime: true,
        endTime: true,
        patternCode: true,
        workPattern: {
          select: {
            name: true,
            category: true,
            isHoliday: true
          }
        }
      },
      orderBy: { workDate: "desc" }
    }).then((result) => {
      console.log("[PERF][history] history-detail-shifts", Date.now() - detailShiftsStart, "ms");
      return result;
    }),
    prisma.attendanceRequest.findMany({
      where: { companyId, userId, targetDate: { gte: start, lt: end } },
      select: { id: true, requestType: true, status: true, targetDate: true, title: true },
      orderBy: { createdAt: "desc" }
    }).then((result) => {
      console.log("[PERF][history] history-detail-attendance-requests", Date.now() - detailAttendanceRequestsStart, "ms");
      return result;
    }),
    prisma.attendanceCorrectionRequest.findMany({
      where: { companyId, userId, targetDate: { gte: start, lt: end } },
      select: { id: true, status: true, targetDate: true },
      orderBy: { createdAt: "desc" }
    }).then((result) => {
      console.log("[PERF][history] history-detail-correction-requests", Date.now() - detailCorrectionRequestsStart, "ms");
      return result;
    }),
    prisma.leaveRequest.findMany({
      where: { companyId, userId, targetDate: { gte: start, lt: end } },
      select: { id: true, status: true, targetDate: true, leaveType: { select: { name: true } } },
      orderBy: { createdAt: "desc" }
    }).then((result) => {
      console.log("[PERF][history] history-detail-leave-requests", Date.now() - detailLeaveRequestsStart, "ms");
      return result;
    })
  ]);

  const detailAggregateStart = Date.now();
  const logsByDate = groupByDate(logs, (log) => toJaDateKey(log.stampedAt));
  const shiftByDate = new Map(shifts.map((shift) => [toJaDateKey(shift.workDate), shift]));
  const requestsByDate = groupByDate(attendanceRequests, (request) => (request.targetDate ? toJaDateKey(request.targetDate) : ""));
  const correctionsByDate = groupByDate(correctionRequests, (request) => toJaDateKey(request.targetDate));
  const leavesByDate = groupByDate(leaveRequests, (request) => toJaDateKey(request.targetDate));

  const days = dates.map((date) => {
    const key = toJaDateKey(date);
    const dayLogs = logsByDate.get(key) ?? [];
    const clockIn = dayLogs.find((log) => log.type === "CLOCK_IN") ?? null;
    const clockOut = [...dayLogs].reverse().find((log) => log.type === "CLOCK_OUT") ?? null;
    const breakMinutes = calcBreakMinutes(dayLogs);
    const workMinutes = calcWorkMinutes(dayLogs);
    const shift = shiftByDate.get(key) ?? null;
    const dayLeaves = leavesByDate.get(key) ?? [];
    const dayCorrections = correctionsByDate.get(key) ?? [];
    const dayRequests = requestsByDate.get(key) ?? [];
    const badges = [
      ...dayLeaves.map((leave) => `${leave.leaveType.name}: ${statusLabels[leave.status] ?? leave.status}`),
      ...dayCorrections.map((request) => `打刻修正: ${statusLabels[request.status] ?? request.status}`),
      ...dayRequests.map((request) => `${requestTypeLabels[request.requestType] ?? request.requestType}: ${statusLabels[request.status] ?? request.status}`)
    ];
    const allStatuses = [
      ...dayLeaves.map((item) => item.status),
      ...dayCorrections.map((item) => item.status),
      ...dayRequests.map((item) => item.status)
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
      badges,
      pendingCount: allStatuses.filter((status) => status === "PENDING").length,
      approvedCount: allStatuses.filter((status) => status === "APPROVED").length
    };
  });

  console.log("[PERF][history] history-detail-aggregate", Date.now() - detailAggregateStart, "ms");
  return { days };
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

function createMonthSummary(ym: string): MonthSummary {
  return {
    ym,
    workDays: 0,
    workMinutes: 0,
    breakMinutes: 0,
    pendingCount: 0,
    approvedCount: 0
  };
}

function addStatusCount(summaries: Map<string, MonthSummary>, targetDate: Date | null, status: string) {
  if (!targetDate) return;
  const summary = summaries.get(toJaMonthKey(targetDate));
  if (!summary) return;
  if (status === "PENDING") summary.pendingCount += 1;
  if (status === "APPROVED") summary.approvedCount += 1;
}

function buildSummaryMonths(availableMonths: string[], selectedYm: string, currentYm: string) {
  const recentMonths = new Set(
    Array.from({ length: summaryMonthLimit }, (_, index) => addMonths(currentYm, -index))
  );
  const months = new Set<string>([currentYm, selectedYm]);

  for (const ym of availableMonths) {
    if (recentMonths.has(ym) || ym === selectedYm || ym === currentYm) {
      months.add(ym);
    }
  }

  return Array.from(months).sort((a, b) => b.localeCompare(a));
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

function calcWorkMinutes(logs: { type: string; stampedAt: Date }[]) {
  const sorted = [...logs].sort((a, b) => a.stampedAt.getTime() - b.stampedAt.getTime());
  const clockIn = sorted.find((log) => log.type === "CLOCK_IN");
  const clockOut = [...sorted].reverse().find((log) => log.type === "CLOCK_OUT");
  if (!clockIn || !clockOut) return 0;
  return Math.max(0, Math.round((clockOut.stampedAt.getTime() - clockIn.stampedAt.getTime()) / 60000 - calcBreakMinutes(sorted)));
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

function normalizeYm(value: string | undefined) {
  return value && /^\d{4}-\d{2}$/.test(value) ? value : null;
}

function currentTokyoMonth() {
  return toJaMonthKey(new Date());
}

function toJaMonthKey(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit"
  }).format(date);
}

function monthRange(ym: string) {
  const start = new Date(`${ym}-01T00:00:00+09:00`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);

  const dates: Date[] = [];
  const cursor = new Date(start);
  while (cursor < end) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return { start, end, dates };
}

function addMonths(ym: string, amount: number) {
  const [year, month] = ym.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
