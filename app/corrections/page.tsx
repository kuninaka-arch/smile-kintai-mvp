import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/components/RequireAuth";
import { CorrectionRequestForm } from "@/components/CorrectionRequestForm";
import Link from "next/link";
import { formatJaDate, formatJaTime, typeLabel } from "@/lib/attendance";

export default async function CorrectionsPage() {
  const session = await requireAuth();

  const requests = await prisma.attendanceCorrectionRequest.findMany({
    where: { companyId: session.user.companyId, userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20
  });

  return (
    <main className="min-h-screen bg-slate-100 pb-24">
      <header className="bg-gradient-to-br from-blue-700 to-sky-500 px-5 pb-8 pt-5 text-white">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between">
            <Link href="/post-login" className="text-lg font-black">☺ 勤怠管理システム</Link>
            <Link href="/home" className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">ホーム</Link>
          </div>
          <h1 className="mt-8 text-3xl font-black">打刻修正申請</h1>
          <p className="mt-2 text-sm opacity-90">打刻漏れ・時刻修正を管理者へ申請できます。</p>
        </div>
      </header>

      <section className="mx-auto -mt-5 max-w-md px-5">
        <div className="rounded-3xl bg-white p-5 shadow-lg">
          <CorrectionRequestForm />
        </div>

        <div className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-black">申請履歴</h2>
          <div className="space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex justify-between">
                  <p className="font-black">{typeLabel(r.requestedType)}</p>
                  <Status status={r.status} />
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {formatJaDate(r.targetDate)} {formatJaTime(r.requestedAt)}
                </p>
                <p className="mt-2 text-sm">{r.reason}</p>
              </div>
            ))}
            {requests.length === 0 && <p className="text-center text-sm text-slate-400">申請履歴はありません</p>}
          </div>
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
