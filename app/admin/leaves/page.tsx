import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/components/RequireAuth";
import { AdminSidebar } from "@/components/AdminSidebar";
import { LeaveActionButtons } from "@/components/LeaveActionButtons";
import { formatJaDate } from "@/lib/attendance";
import Link from "next/link";

const pageSize = 20;

function statusLabel(status: string) {
  if (status === "APPROVED") return "承認";
  if (status === "REJECTED") return "却下";
  return "申請中";
}

function statusClass(status: string) {
  if (status === "APPROVED") return "bg-green-50 text-green-700";
  if (status === "REJECTED") return "bg-red-50 text-red-700";
  return "bg-orange-50 text-orange-700";
}

function tokyoDateRange(date: Date) {
  const key = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
  const start = new Date(`${key}T00:00:00+09:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { key, start, end };
}

function parsePage(value?: string) {
  const page = Number(value);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function shiftMapKey(userId: string, date: Date) {
  return `${userId}:${tokyoDateRange(date).key}`;
}

export default async function AdminLeavesPage({ searchParams }: { searchParams?: { page?: string } }) {
  const session = await requireAdmin();
  const page = parsePage(searchParams?.page);
  const where = { companyId: session.user.companyId };

  const [totalCount, requests] = await Promise.all([
    prisma.leaveRequest.count({ where }),
    prisma.leaveRequest.findMany({
      where,
      select: {
        id: true,
        userId: true,
        targetDate: true,
        unit: true,
        hours: true,
        reason: true,
        status: true,
        user: {
          select: {
            name: true,
            department: true
          }
        },
        leaveType: {
          select: {
            name: true
          }
        }
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pendingFullDayRequests = requests.filter((request) => request.status === "PENDING" && request.unit === "FULL_DAY");
  const shiftConditions = pendingFullDayRequests.map((request) => {
    const { start, end } = tokyoDateRange(request.targetDate);
    return {
      userId: request.userId,
      workDate: { gte: start, lt: end }
    };
  });

  const shifts = shiftConditions.length > 0
    ? await prisma.shift.findMany({
        where: {
          companyId: session.user.companyId,
          OR: shiftConditions
        },
        select: {
          userId: true,
          workDate: true
        }
      })
    : [];

  const existingShiftKeys = new Set(shifts.map((shift) => shiftMapKey(shift.userId, shift.workDate)));
  const existingShiftRequestIds = new Set(
    pendingFullDayRequests
      .filter((request) => existingShiftKeys.has(shiftMapKey(request.userId, request.targetDate)))
      .map((request) => request.id)
  );

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="leaves" />
      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto max-w-7xl">
            <h1 className="text-2xl font-black">休暇申請承認</h1>
            <p className="text-sm text-slate-500">社員からの休暇申請を承認・却下できます。全日休暇は承認時にシフト表へ反映されます。</p>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-6">
          <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <p className="border-b px-5 py-3 text-xs font-bold text-slate-400">横にスクロールできます</p>
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full min-w-[1040px] text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs text-slate-500 shadow-sm">
                  <tr>
                    <th className="p-4">社員</th>
                    <th className="p-4">所属</th>
                    <th className="p-4">対象日</th>
                    <th className="p-4">休暇種別</th>
                    <th className="p-4">単位</th>
                    <th className="p-4">理由</th>
                    <th className="p-4">状態</th>
                    <th className="p-4">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id} className="border-t">
                      <td className="p-4 font-black">{request.user.name}</td>
                      <td className="p-4">{request.user.department ?? "-"}</td>
                      <td className="p-4">{formatJaDate(request.targetDate)}</td>
                      <td className="p-4 font-bold">{request.leaveType.name}</td>
                      <td className="p-4">{request.unit === "HOUR" ? `${request.hours}時間` : "1日"}</td>
                      <td className="max-w-[280px] p-4">{request.reason}</td>
                      <td className="p-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(request.status)}`}>
                          {statusLabel(request.status)}
                        </span>
                      </td>
                      <td className="p-4">
                        <LeaveActionButtons
                          id={request.id}
                          disabled={request.status !== "PENDING"}
                          hasExistingShift={existingShiftRequestIds.has(request.id)}
                        />
                      </td>
                    </tr>
                  ))}
                  {requests.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-sm text-slate-400">休暇申請はありません</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <p>
              {totalCount}件中 {requests.length === 0 ? 0 : (page - 1) * pageSize + 1}-
              {Math.min(page * pageSize, totalCount)}件を表示
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={`/admin/leaves?page=${Math.max(1, page - 1)}`}
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
                href={`/admin/leaves?page=${page + 1}`}
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
