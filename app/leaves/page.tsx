import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/components/RequireAuth";
import { LeaveRequestForm } from "@/components/LeaveRequestForm";
import { formatJaDate } from "@/lib/attendance";

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

export default async function LeavesPage() {
  const session = await requireAuth();

  const [leaveTypes, requests] = await Promise.all([
    prisma.leaveTypeMaster.findMany({
      where: { companyId: session.user.companyId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    }),
    prisma.leaveRequest.findMany({
      where: { companyId: session.user.companyId, userId: session.user.id },
      include: { leaveType: true },
      orderBy: { createdAt: "desc" },
      take: 30
    })
  ]);

  return (
    <main className="min-h-screen bg-slate-100 pb-24">
      <header className="bg-gradient-to-br from-blue-700 to-sky-500 px-5 pb-8 pt-5 text-white">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between">
            <Link href="/post-login" className="text-lg font-black">勤怠管理システム</Link>
            <Link href="/home" className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">ホーム</Link>
          </div>
          <h1 className="mt-8 text-3xl font-black">休暇申請</h1>
          <p className="mt-2 text-sm opacity-90">有休、代休、特別休暇などを申請できます。</p>
        </div>
      </header>

      <section className="mx-auto -mt-5 max-w-md px-5">
        <div className="rounded-3xl bg-white p-5 shadow-lg">
          <LeaveRequestForm leaveTypes={leaveTypes.map((leaveType) => ({
            id: leaveType.id,
            name: leaveType.name,
            allowHourly: leaveType.allowHourly
          }))} />
        </div>

        <div className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-black">申請履歴</h2>
          <div className="space-y-3">
            {requests.map((request) => (
              <div key={request.id} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex justify-between gap-3">
                  <p className="font-black">{request.leaveType.name}</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(request.status)}`}>
                    {statusLabel(request.status)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {formatJaDate(request.targetDate)} / {request.unit === "HOUR" ? `${request.hours}時間` : "1日"}
                </p>
                <p className="mt-2 text-sm">{request.reason}</p>
              </div>
            ))}
            {requests.length === 0 && <p className="text-center text-sm text-slate-400">申請履歴はありません</p>}
          </div>
        </div>
      </section>
    </main>
  );
}
