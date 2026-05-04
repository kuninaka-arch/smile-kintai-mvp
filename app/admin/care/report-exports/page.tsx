import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/AdminSidebar";
import { requireAdmin } from "@/components/RequireAuth";
import { isCareCompany } from "@/lib/industry";
import { prisma } from "@/lib/prisma";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function reportTypeLabel(reportType: string) {
  if (reportType === "CARE_ADDITION_SUMMARY") return "介護加算資料サマリー";
  return reportType;
}

function fileTypeLabel(fileType: string) {
  if (fileType === "EXCEL") return "Excel";
  if (fileType === "PDF") return "PDF";
  return fileType;
}

export default async function CareReportExportsPage() {
  const session = await requireAdmin();
  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { industryType: true }
  });

  if (!isCareCompany(company?.industryType)) {
    redirect("/admin");
  }

  const histories = await prisma.reportExportHistory.findMany({
    where: { companyId: session.user.companyId },
    include: {
      user: {
        select: {
          name: true,
          email: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="care-report-exports" />

      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto max-w-7xl">
            <p className="text-sm font-black text-emerald-700">介護施設モード</p>
            <h1 className="text-2xl font-black text-slate-900">帳票出力履歴</h1>
            <p className="mt-1 text-sm text-slate-500">
              加算資料などの帳票を出力した履歴を新しい順で確認します。
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-6">
          <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="border-b p-5">
              <h2 className="text-lg font-black text-slate-900">出力履歴</h2>
              <p className="text-sm text-slate-500">直近200件を表示しています。</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="p-4">出力日時</th>
                    <th className="p-4">出力ユーザー</th>
                    <th className="p-4">対象年月</th>
                    <th className="p-4">帳票種別</th>
                    <th className="p-4">ファイル種別</th>
                  </tr>
                </thead>
                <tbody>
                  {histories.map((history) => (
                    <tr key={history.id} className="border-t">
                      <td className="p-4 font-bold text-slate-900">{formatDateTime(history.createdAt)}</td>
                      <td className="p-4">
                        <p className="font-black text-slate-900">{history.user.name}</p>
                        <p className="text-xs font-bold text-slate-500">{history.user.email}</p>
                      </td>
                      <td className="p-4 font-bold text-slate-700">{history.targetMonth}</td>
                      <td className="p-4 font-bold text-slate-700">{reportTypeLabel(history.reportType)}</td>
                      <td className="p-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${
                            history.fileType === "PDF" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {fileTypeLabel(history.fileType)}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {histories.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center font-bold text-slate-500">
                        まだ帳票出力履歴はありません。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
