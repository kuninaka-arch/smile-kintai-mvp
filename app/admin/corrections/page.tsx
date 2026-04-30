import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/components/RequireAuth";
import { AdminSidebar } from "@/components/AdminSidebar";
import { typeLabel } from "@/lib/attendance";
import { CorrectionActionButtons } from "@/components/CorrectionActionButtons";

export default async function AdminCorrectionsPage() {
  const session = await requireAdmin();

  const requests = await prisma.attendanceCorrectionRequest.findMany({
    where: { companyId: session.user.companyId },
    include: { user: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="corrections" />
      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto max-w-7xl">
            <h1 className="text-2xl font-black">打刻修正申請</h1>
            <p className="text-sm text-slate-500">社員からの打刻修正申請を承認・却下できます。</p>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-6">
          <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="p-4">社員</th>
                  <th className="p-4">対象日</th>
                  <th className="p-4">種別</th>
                  <th className="p-4">希望時刻</th>
                  <th className="p-4">理由</th>
                  <th className="p-4">状態</th>
                  <th className="p-4">操作</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-4 font-black">{r.user.name}</td>
                    <td className="p-4">{r.targetDate.toLocaleDateString("ja-JP")}</td>
                    <td className="p-4">{typeLabel(r.requestedType)}</td>
                    <td className="p-4">{r.requestedAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="p-4 max-w-[280px]">{r.reason}</td>
                    <td className="p-4"><Status status={r.status} /></td>
                    <td className="p-4"><CorrectionActionButtons id={r.id} disabled={r.status !== "PENDING"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </section>
    </main>
  );
}

function Status({ status }: { status: string }) {
  const cls = status === "APPROVED" ? "bg-green-50 text-green-700" : status === "REJECTED" ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700";
  const label = status === "APPROVED" ? "承認" : status === "REJECTED" ? "却下" : "申請中";
  return <span className={`rounded-full px-3 py-1 text-xs font-black ${cls}`}>{label}</span>;
}
