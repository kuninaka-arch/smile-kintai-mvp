import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/components/RequireAuth";
import Link from "next/link";
import { AdminSidebar } from "@/components/AdminSidebar";
import { ShiftMonthlyGrid } from "@/components/ShiftMonthlyGrid";
import { isCareCompany } from "@/lib/industry";

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

function minutesBetween(startTime: string, endTime: string, breakMinutes = 0) {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if ([sh, sm, eh, em].some((value) => Number.isNaN(value))) return 0;
  let minutes = eh * 60 + em - (sh * 60 + sm) - breakMinutes;
  if (minutes < 0) minutes += 24 * 60;
  return Math.max(0, minutes);
}

function actualWorkMinutes(logs: Array<{ type: string; stampedAt: Date }>) {
  let total = 0;
  let clockIn: Date | null = null;
  let breakStart: Date | null = null;
  let breakMinutes = 0;

  for (const log of logs) {
    if (log.type === "CLOCK_IN") {
      clockIn = log.stampedAt;
      breakStart = null;
      breakMinutes = 0;
    } else if (log.type === "BREAK_START") {
      breakStart = log.stampedAt;
    } else if (log.type === "BREAK_END" && breakStart) {
      breakMinutes += Math.max(0, log.stampedAt.getTime() - breakStart.getTime()) / 60000;
      breakStart = null;
    } else if (log.type === "CLOCK_OUT" && clockIn) {
      total += Math.max(0, log.stampedAt.getTime() - clockIn.getTime()) / 60000 - breakMinutes;
      clockIn = null;
      breakStart = null;
      breakMinutes = 0;
    }
  }

  return Math.max(0, Math.round(total));
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withDbRetry<T>(read: () => Promise<T>, fallback: T, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await read();
    } catch {
      if (i < attempts - 1) await wait(350 * (i + 1));
    }
  }
  return fallback;
}

async function getShiftUsers(companyId: string) {
  const users = await withDbRetry(
      () =>
        prisma.user.findMany({
          where: { companyId },
          select: {
            id: true,
            name: true,
            department: true,
            displayOrder: true,
            positionMaster: { select: { name: true } },
            createdAt: true
          },
          orderBy: [{ displayOrder: "asc" }, { department: "asc" }, { createdAt: "asc" }]
        }),
      []
    );

  return users;
}

export default async function ShiftsPage({ searchParams }: { searchParams: { ym?: string } }) {
  const session = await requireAdmin();
  const now = new Date();
  const ym = searchParams.ym ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [year, month] = ym.split("-").map(Number);

  const { start, end } = tokyoMonthRange(year, month);
  const dayCount = daysInMonth(year, month);

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { industryType: true }
  });
  const enableAfterNightAutoFill = isCareCompany(company?.industryType);

  const users = await getShiftUsers(session.user.companyId);
  const shifts = await withDbRetry(
    () => prisma.shift.findMany({
      where: {
        companyId: session.user.companyId,
        workDate: { gte: start, lt: end }
      },
      orderBy: [{ workDate: "asc" }, { startTime: "asc" }]
    }),
    []
  );
  const workPatterns = await withDbRetry(
    () => prisma.workPattern.findMany({
      where: { companyId: session.user.companyId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    }),
    []
  );
  const events = await withDbRetry(
    () => prisma.shiftEvent.findMany({
      where: {
        companyId: session.user.companyId,
        workDate: { gte: start, lt: end }
      },
      orderBy: { workDate: "asc" }
    }),
    []
  );
  const attendanceLogs = await withDbRetry(
    () => prisma.attendanceLog.findMany({
      where: {
        companyId: session.user.companyId,
        stampedAt: { gte: start, lt: end }
      },
      orderBy: { stampedAt: "asc" }
    }),
    []
  );
  const leaveRequests = await withDbRetry(
    () => prisma.leaveRequest.findMany({
      where: {
        companyId: session.user.companyId,
        status: "APPROVED",
        targetDate: { gte: start, lt: end }
      },
      include: { leaveType: true },
      orderBy: { targetDate: "asc" }
    }),
    []
  );

  const initialShifts = shifts.map((s) => ({
    id: s.id,
    userId: s.userId,
    date: dateKey(s.workDate),
    startTime: s.startTime,
    endTime: s.endTime,
    breakMinutes: s.breakMinutes,
    patternCode: s.patternCode,
    workPatternId: s.workPatternId
  }));

  const workPatternRows = workPatterns.map((pattern) => ({
    id: pattern.id,
    code: pattern.code,
    name: pattern.name,
    category: pattern.category,
    startTime: pattern.startTime,
    endTime: pattern.endTime,
    breakMinutes: pattern.breakMinutes,
    colorClass: pattern.colorClass,
    isHoliday: pattern.isHoliday,
    autoCreateAfterNight: pattern.autoCreateAfterNight
  }));

  const initialEvents = events.map((event) => ({
    date: dateKey(event.workDate),
    title: event.title
  }));

  const usersForGrid = users.map((u, index) => {
    const userLogs = attendanceLogs.filter((log) => log.userId === u.id);
    const userLeaveMinutes = leaveRequests
      .filter((request) => request.userId === u.id)
      .reduce((sum, request) => sum + (request.unit === "HOUR" ? Math.round(Number(request.hours ?? 0) * 60) : 8 * 60), 0);
    return {
      id: u.id,
      no: String(index + 1).padStart(3, "0"),
      name: u.name,
      position: u.positionMaster?.name ?? "",
      department: u.department ?? "-",
      displayOrder: u.displayOrder,
      actualWorkMinutes: actualWorkMinutes(userLogs),
      paidLeaveUsedMinutes: userLeaveMinutes
    };
  });

  const departments = Array.from(new Set(usersForGrid.map((user) => user.department).filter(Boolean))).sort();

  const prevMonth = new Date(year, month - 2, 1);
  const nextMonth = new Date(year, month, 1);
  const prevYm = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
  const nextYm = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="shifts" />

      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-black">月間シフト設定</h1>
              <p className="text-sm text-slate-500">社員ごとに1ヶ月分のシフトをまとめて登録できます。</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin/masters/work-patterns"
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-slate-700"
              >
                勤務パターン管理
              </Link>
              <Link
                href="/admin/employees"
                className="rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-blue-50 hover:text-blue-700"
              >
                社員管理
              </Link>
              <Link href={`/admin/shifts?ym=${prevYm}`} className="rounded-xl bg-slate-100 px-3 py-2 font-black text-slate-700">‹</Link>
              <form className="flex items-center gap-2">
                <input name="ym" type="month" defaultValue={ym} className="rounded-xl border px-4 py-2" />
                <button className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white">表示</button>
              </form>
              <Link href={`/admin/shifts?ym=${nextYm}`} className="rounded-xl bg-slate-100 px-3 py-2 font-black text-slate-700">›</Link>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-6">
          <ShiftMonthlyGrid
            ym={ym}
            year={year}
            month={month}
            dayCount={dayCount}
            users={usersForGrid}
            initialShifts={initialShifts}
            workPatterns={workPatternRows}
            initialEvents={initialEvents}
            departments={departments}
            enableAfterNightAutoFill={enableAfterNightAutoFill}
          />
        </div>
      </section>
    </main>
  );
}
