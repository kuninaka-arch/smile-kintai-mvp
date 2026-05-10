import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/components/RequireAuth";
import { AdminSidebar } from "@/components/AdminSidebar";
import { PeriodLockButtons } from "@/components/PeriodLockButtons";
import { minutesToHHMM } from "@/lib/attendance";
import { formatDateKey, getPeriodLock } from "@/lib/period-lock";
import { summarizeMonthlyAttendance } from "@/lib/monthly-attendance";

const pageSize = 10;

function parsePage(value?: string) {
  const page = Number(value);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function monthlyPageHref(page: number, ym: string, department: string) {
  const params = new URLSearchParams({
    ym,
    department,
    page: String(page)
  });
  return `/admin/monthly?${params.toString()}`;
}

function groupByUserId<T extends { userId: string }>(items: T[]) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const list = map.get(item.userId);
    if (list) {
      list.push(item);
    } else {
      map.set(item.userId, [item]);
    }
  }
  return map;
}

export default async function MonthlyPage({ searchParams }: { searchParams: { ym?: string; department?: string; page?: string } }) {
  const totalStart = Date.now();
  const perfId = Math.random().toString(36).slice(2, 8);
  console.log("[PERF][admin-monthly]", perfId, "total:start");

  const authStart = Date.now();
  const session = await requireAdmin();
  console.log("[PERF][admin-monthly]", perfId, "auth-session", Date.now() - authStart, "ms");

  const parseStart = Date.now();
  const now = new Date();
  const ym = searchParams.ym ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const selectedDepartment = searchParams.department ?? "all";
  const requestedPage = parsePage(searchParams.page);
  console.log("[PERF][admin-monthly]", perfId, "parse-search-params", Date.now() - parseStart, "ms");

  const userWhereStart = Date.now();
  const userWhere = {
    companyId: session.user.companyId,
    ...(selectedDepartment === "all" ? {} : { department: selectedDepartment === "-" ? null : selectedDepartment })
  };
  console.log("[PERF][admin-monthly]", perfId, "build-user-where", Date.now() - userWhereStart, "ms");

  const companyStart = Date.now();
  const periodPromise = getPeriodLock(session.user.companyId, ym).then((result) => {
    console.log("[PERF][admin-monthly]", perfId, "load-company", Date.now() - companyStart, "ms");
    return result;
  });

  const departmentsStart = Date.now();
  const departmentsPromise = prisma.user.findMany({
    where: { companyId: session.user.companyId },
    select: { department: true },
    orderBy: [{ department: "asc" }, { displayOrder: "asc" }, { createdAt: "asc" }]
  }).then((departmentsSource) => {
    const departments = Array.from(new Set(departmentsSource.map((user) => user.department ?? "-"))).sort();
    console.log("[PERF][admin-monthly]", perfId, "load-departments", Date.now() - departmentsStart, "ms");
    return departments;
  });

  const userCountStart = Date.now();
  const totalCountPromise = prisma.user.count({ where: userWhere }).then((count) => {
    console.log("[PERF][admin-monthly]", perfId, "load-user-count", Date.now() - userCountStart, "ms");
    return count;
  });

  const [period, departments, totalCount] = await Promise.all([periodPromise, departmentsPromise, totalCountPromise]);
  const start = period.periodStart;
  const end = period.periodEndExclusive;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedPage, totalPages);

  const usersStart = Date.now();
  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true,
      name: true,
      department: true
    },
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: [{ department: "asc" }, { displayOrder: "asc" }, { createdAt: "asc" }]
  });
  console.log("[PERF][admin-monthly]", perfId, "load-users-basic", Date.now() - usersStart, "ms");

  const relatedStart = Date.now();
  const userIds = users.map((user) => user.id);
  const [attendanceLogs, shifts, paidLeaveSummaries, leaveRequests] = userIds.length > 0
    ? await Promise.all([
        (async () => {
          const startedAt = Date.now();
          const result = await prisma.attendanceLog.findMany({
            where: {
              companyId: session.user.companyId,
              userId: { in: userIds },
              stampedAt: { gte: start, lt: end }
            },
            select: {
              userId: true,
              type: true,
              stampedAt: true
            },
            orderBy: { stampedAt: "asc" }
          });
          console.log("[PERF][admin-monthly]", perfId, "monthly-related-attendance-logs", Date.now() - startedAt, "ms");
          return result;
        })(),
        (async () => {
          const startedAt = Date.now();
          const baseShifts = await prisma.shift.findMany({
            where: {
              companyId: session.user.companyId,
              userId: { in: userIds },
              workDate: { gte: start, lt: end }
            },
            select: {
              userId: true,
              workDate: true,
              startTime: true,
              endTime: true,
              breakMinutes: true,
              patternCode: true,
              workPatternId: true
            },
            orderBy: { workDate: "asc" }
          });
          const workPatternIds = Array.from(new Set(baseShifts.map((shift) => shift.workPatternId).filter((id): id is string => Boolean(id))));
          const workPatterns = workPatternIds.length > 0
            ? await prisma.workPattern.findMany({
                where: {
                  companyId: session.user.companyId,
                  id: { in: workPatternIds }
                },
                select: {
                  id: true,
                  name: true,
                  isHoliday: true
                }
              })
            : [];
          const workPatternById = new Map(workPatterns.map((workPattern) => [workPattern.id, workPattern]));
          const result = baseShifts.map((shift) => ({
            ...shift,
            workPattern: shift.workPatternId ? workPatternById.get(shift.workPatternId) ?? null : null
          }));
          console.log("[PERF][admin-monthly]", perfId, "monthly-related-shifts", Date.now() - startedAt, "ms");
          return result;
        })(),
        (async () => {
          const startedAt = Date.now();
          const result = await prisma.paidLeave.groupBy({
            by: ["userId"],
            where: {
              companyId: session.user.companyId,
              userId: { in: userIds }
            },
            _sum: {
              grantedDays: true,
              usedDays: true
            }
          });
          console.log("[PERF][admin-monthly]", perfId, "monthly-related-paid-leaves", Date.now() - startedAt, "ms");
          return result;
        })(),
        (async () => {
          const startedAt = Date.now();
          const result = await prisma.leaveRequest.findMany({
            where: {
              companyId: session.user.companyId,
              userId: { in: userIds },
              status: "APPROVED",
              targetDate: { gte: start, lt: end }
            },
            select: {
              userId: true,
              targetDate: true,
              unit: true,
              hours: true
            }
          });
          console.log("[PERF][admin-monthly]", perfId, "monthly-related-leave-requests", Date.now() - startedAt, "ms");
          return result;
        })()
      ])
    : [[], [], [], []];
  console.log("[PERF][admin-monthly]", perfId, "load-monthly-related-data", Date.now() - relatedStart, "ms");

  const mapStart = Date.now();
  const logsByUserId = groupByUserId(attendanceLogs);
  const shiftsByUserId = groupByUserId(shifts);
  const paidLeavesByUserId = new Map<string, { grantedDays: number; usedDays: number }[]>();
  for (const summary of paidLeaveSummaries) {
    paidLeavesByUserId.set(summary.userId, [
      {
        grantedDays: Number(summary._sum.grantedDays ?? 0),
        usedDays: Number(summary._sum.usedDays ?? 0)
      }
    ]);
  }
  const leaveRequestsByUserId = groupByUserId(leaveRequests);
  console.log("[PERF][admin-monthly]", perfId, "map-monthly-related-data", Date.now() - mapStart, "ms");

  const aggregateStart = Date.now();
  const rows = users.map((user) => {
    const metrics = summarizeMonthlyAttendance({
      logs: logsByUserId.get(user.id) ?? [],
      shifts: shiftsByUserId.get(user.id) ?? [],
      leaves: leaveRequestsByUserId.get(user.id) ?? []
    });
    const leave = paidLeavesByUserId.get(user.id)?.[0];

    return {
      user,
      metrics,
      leaveRemain: leave ? leave.grantedDays - leave.usedDays : 0
    };
  });

  const totals = rows.reduce(
    (sum, row) => {
      sum.workDays += row.metrics.workDays;
      sum.actualWorkMinutes += row.metrics.actualWorkMinutes;
      sum.scheduledWorkMinutes += row.metrics.scheduledWorkMinutes;
      sum.totalExtraMinutes += row.metrics.totalExtraMinutes;
      sum.regularOvertimeMinutes += row.metrics.regularOvertimeMinutes;
      sum.nightOvertimeMinutes += row.metrics.nightOvertimeMinutes;
      sum.holidayWorkMinutes += row.metrics.holidayWorkMinutes;
      sum.holidayNightWorkMinutes += row.metrics.holidayNightWorkMinutes;
      sum.lateEarlyMinutes += row.metrics.lateEarlyMinutes;
      sum.absenceDays += row.metrics.absenceDays;
      sum.leaveMinutes += row.metrics.leaveMinutes;
      sum.nightShiftCount += row.metrics.nightShiftCount;
      sum.semiNightShiftCount += row.metrics.semiNightShiftCount;
      sum.lodgingShiftCount += row.metrics.lodgingShiftCount;
      return sum;
    },
    {
      workDays: 0,
      actualWorkMinutes: 0,
      scheduledWorkMinutes: 0,
      totalExtraMinutes: 0,
      regularOvertimeMinutes: 0,
      nightOvertimeMinutes: 0,
      holidayWorkMinutes: 0,
      holidayNightWorkMinutes: 0,
      lateEarlyMinutes: 0,
      absenceDays: 0,
      leaveMinutes: 0,
      nightShiftCount: 0,
      semiNightShiftCount: 0,
      lodgingShiftCount: 0
    }
  );
  console.log("[PERF][admin-monthly]", perfId, "aggregate-monthly-data", Date.now() - aggregateStart, "ms");
  const renderPrepStart = Date.now();
  const pagination = (
    <MonthlyPagination
      totalCount={totalCount}
      page={page}
      totalPages={totalPages}
      ym={ym}
      selectedDepartment={selectedDepartment}
    />
  );
  console.log("[PERF][admin-monthly]", perfId, "render-prep", Date.now() - renderPrepStart, "ms");
  console.log("[PERF][admin-monthly]", perfId, "total", Date.now() - totalStart, "ms");

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="monthly" />

      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-black">勤怠月次集計</h1>
              <p className="text-sm text-slate-500">{ym} の勤怠集計</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <form className="flex flex-wrap gap-2">
                <select name="department" defaultValue={selectedDepartment} className="rounded-xl border px-4 py-2">
                  <option value="all">全従業員</option>
                  {departments.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
                <input name="ym" type="month" defaultValue={ym} className="rounded-xl border px-4 py-2" />
                <button className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white">検索</button>
              </form>
              <Link
                className="rounded-xl bg-green-600 px-4 py-2 font-bold text-white"
                href={`/api/admin/monthly.csv?ym=${ym}&department=${encodeURIComponent(selectedDepartment)}`}
              >
                CSV出力
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-6">
          <section className={`mb-6 rounded-3xl p-5 shadow-sm ${period.locked ? "bg-slate-900 text-white" : "bg-white"}`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-bold opacity-80">勤怠締め</p>
                <h2 className="mt-1 text-xl font-black">{period.locked ? "締め済み" : "未締め"}</h2>
                <p className="mt-1 text-sm opacity-80">
                  締め日: {period.closingDay >= 31 ? "月末" : `${period.closingDay}日`} / 対象期間: {formatDateKey(period.periodStart)} - {formatDateKey(period.periodEnd)}
                </p>
              </div>
              <PeriodLockButtons ym={ym} locked={period.locked} />
            </div>
          </section>

          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <SummaryCard label="総出勤日数" value={`${totals.workDays}日`} />
            <SummaryCard label="総労働時間" value={minutesToHHMM(totals.actualWorkMinutes)} />
            <SummaryCard label="勤務予定時間" value={minutesToHHMM(totals.scheduledWorkMinutes)} />
            <SummaryCard label="総時間外" value={minutesToHHMM(totals.totalExtraMinutes)} />
            <SummaryCard label="欠勤日数" value={`${totals.absenceDays}日`} />
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SmallSummary label="普通残業" value={minutesToHHMM(totals.regularOvertimeMinutes)} />
            <SmallSummary label="深夜残業" value={minutesToHHMM(totals.nightOvertimeMinutes)} />
            <SmallSummary label="休日出勤" value={minutesToHHMM(totals.holidayWorkMinutes)} />
            <SmallSummary label="休日深夜" value={minutesToHHMM(totals.holidayNightWorkMinutes)} />
            <SmallSummary label="遅刻早退" value={minutesToHHMM(totals.lateEarlyMinutes)} />
            <SmallSummary label="休暇時間" value={minutesToHHMM(totals.leaveMinutes)} />
            <SmallSummary label="夜勤 / 準夜勤" value={`${totals.nightShiftCount} / ${totals.semiNightShiftCount}回`} />
            <SmallSummary label="宿直" value={`${totals.lodgingShiftCount}回`} />
          </div>

          <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="border-b p-5">
              <h2 className="text-lg font-black">社員別集計</h2>
              <p className="text-sm text-slate-500">シフト予定、打刻実績、承認済み休暇をもとに集計します。</p>
            </div>
            <div className="border-b px-5 py-3">
              {pagination}
            </div>
            <div className="max-h-[68vh] overflow-auto">
              <table className="w-full min-w-[1680px] text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="sticky left-0 z-20 bg-slate-50 p-4 shadow-[1px_0_0_#e2e8f0]">明細</th>
                    <th className="p-4">氏名</th>
                    <th className="p-4">所属</th>
                    <th className="p-4">出勤日数</th>
                    <th className="p-4">欠勤日数</th>
                    <th className="p-4">総労働時間</th>
                    <th className="p-4">勤務予定時間</th>
                    <th className="p-4">普通残業</th>
                    <th className="p-4">深夜残業</th>
                    <th className="p-4">休日出勤</th>
                    <th className="p-4">休日深夜</th>
                    <th className="p-4">遅刻早退</th>
                    <th className="p-4">休暇時間</th>
                    <th className="p-4">夜勤</th>
                    <th className="p-4">準夜勤</th>
                    <th className="p-4">宿直</th>
                    <th className="p-4">有給残</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.user.id} className="group border-t hover:bg-slate-50">
                      <td className="sticky left-0 z-10 bg-white p-4 shadow-[1px_0_0_#e2e8f0] group-hover:bg-slate-50">
                        <Link
                          href={`/admin/employee-monthly?userId=${row.user.id}&ym=${ym}&department=${encodeURIComponent(row.user.department ?? "-")}`}
                          className="inline-flex rounded-lg bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 ring-1 ring-blue-100 hover:bg-blue-100"
                        >
                          明細
                        </Link>
                      </td>
                      <td className="p-4 font-black">{row.user.name}</td>
                      <td className="p-4">{row.user.department ?? "-"}</td>
                      <td className="p-4 font-bold">{row.metrics.workDays}日</td>
                      <td className="p-4 font-bold text-red-700">{row.metrics.absenceDays}日</td>
                      <td className="p-4 font-bold text-blue-700">{minutesToHHMM(row.metrics.actualWorkMinutes)}</td>
                      <td className="p-4 font-bold text-slate-700">{minutesToHHMM(row.metrics.scheduledWorkMinutes)}</td>
                      <td className="p-4 font-bold text-orange-700">{minutesToHHMM(row.metrics.regularOvertimeMinutes)}</td>
                      <td className="p-4 font-bold text-indigo-700">{minutesToHHMM(row.metrics.nightOvertimeMinutes)}</td>
                      <td className="p-4 font-bold text-rose-700">{minutesToHHMM(row.metrics.holidayWorkMinutes)}</td>
                      <td className="p-4 font-bold text-purple-700">{minutesToHHMM(row.metrics.holidayNightWorkMinutes)}</td>
                      <td className="p-4 font-bold text-red-700">{minutesToHHMM(row.metrics.lateEarlyMinutes)}</td>
                      <td className="p-4 font-bold text-slate-700">{minutesToHHMM(row.metrics.leaveMinutes)}</td>
                      <td className="p-4 font-bold">{row.metrics.nightShiftCount}回</td>
                      <td className="p-4 font-bold">{row.metrics.semiNightShiftCount}回</td>
                      <td className="p-4 font-bold">{row.metrics.lodgingShiftCount}回</td>
                      <td className="p-4 font-bold">{row.leaveRemain}日</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
            <p>
              全 {totalCount}名中 {totalCount === 0 ? 0 : (page - 1) * pageSize + 1}〜
              {Math.min(page * pageSize, totalCount)}名を表示
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={monthlyPageHref(Math.max(1, page - 1), ym, selectedDepartment)}
                className={`rounded-lg border px-3 py-2 font-bold ${
                  page <= 1 ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-white"
                }`}
                aria-disabled={page <= 1}
              >
                前へ
              </Link>
              <span className="font-bold">
                {page} / {totalPages}
              </span>
              <Link
                href={monthlyPageHref(page + 1, ym, selectedDepartment)}
                className={`rounded-lg border px-3 py-2 font-bold ${
                  page >= totalPages ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-white"
                }`}
                aria-disabled={page >= totalPages}
              >
                次へ
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function MonthlyPagination({
  totalCount,
  page,
  totalPages,
  ym,
  selectedDepartment
}: {
  totalCount: number;
  page: number;
  totalPages: number;
  ym: string;
  selectedDepartment: string;
}) {
  return (
    <div className="flex flex-col gap-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
      <p>
        全 {totalCount}名中 {totalCount === 0 ? 0 : (page - 1) * pageSize + 1}〜
        {Math.min(page * pageSize, totalCount)}名を表示
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={monthlyPageHref(Math.max(1, page - 1), ym, selectedDepartment)}
          className={`rounded-lg border px-3 py-2 font-bold ${
            page <= 1 ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-white"
          }`}
          aria-disabled={page <= 1}
        >
          前へ
        </Link>
        <span className="font-bold">
          {page} / {totalPages}
        </span>
        <Link
          href={monthlyPageHref(page + 1, ym, selectedDepartment)}
          className={`rounded-lg border px-3 py-2 font-bold ${
            page >= totalPages ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-white"
          }`}
          aria-disabled={page >= totalPages}
        >
          次へ
        </Link>
      </div>
    </div>
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

function SmallSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-black text-slate-900">{value}</p>
    </div>
  );
}
