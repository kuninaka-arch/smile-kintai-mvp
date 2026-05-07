import Link from "next/link";
import { AdminSidebar } from "@/components/AdminSidebar";
import { AiHelpAdminManager } from "@/components/AiHelpAdminManager";
import { requireAdmin } from "@/components/RequireAuth";
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

export default async function AdminAiHelpPage() {
  const session = await requireAdmin();
  const [faqs, unanswered, histories] = await Promise.all([
    prisma.aiHelpFaq.findMany({
      where: { companyId: session.user.companyId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }]
    }),
    prisma.aiHelpUnansweredQuestion.findMany({
      where: { companyId: session.user.companyId, resolved: false },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 50
    }),
    prisma.aiHelpConversation.findMany({
      where: { companyId: session.user.companyId },
      include: { user: { select: { name: true, email: true } }, matchedFaq: { select: { question: true } } },
      orderBy: { createdAt: "desc" },
      take: 20
    })
  ]);

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="ai-help" />
      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-blue-700">問い合わせ管理</p>
              <h1 className="text-2xl font-black text-slate-900">AI問い合わせ管理</h1>
              <p className="mt-1 text-sm text-slate-500">FAQの追加・編集と、回答できなかった質問の確認を行います。</p>
            </div>
            <Link href="/help" className="rounded-xl border bg-white px-4 py-2 font-black text-slate-700">
              利用者画面を開く
            </Link>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-6 px-5 py-6">
          <div className="grid gap-4 md:grid-cols-3">
            <SummaryCard label="FAQ件数" value={`${faqs.length}件`} />
            <SummaryCard label="未回答質問" value={`${unanswered.length}件`} valueClassName={unanswered.length > 0 ? "text-orange-600" : "text-emerald-600"} />
            <SummaryCard label="直近問い合わせ" value={`${histories.length}件`} />
          </div>

          <AiHelpAdminManager
            faqs={faqs.map((faq) => ({
              id: faq.id,
              question: faq.question,
              answer: faq.answer,
              keywords: faq.keywords,
              sortOrder: faq.sortOrder,
              isActive: faq.isActive
            }))}
            unanswered={unanswered.map((item) => ({
              id: item.id,
              question: item.question,
              createdAtLabel: formatDateTime(item.createdAt),
              userName: item.user?.name ?? "不明",
              userEmail: item.user?.email ?? "-"
            }))}
          />

          <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="border-b p-5">
              <h2 className="text-lg font-black text-slate-900">問い合わせ履歴</h2>
              <p className="text-sm text-slate-500">直近20件を表示しています。</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="p-4">日時</th>
                    <th className="p-4">ユーザー</th>
                    <th className="p-4">質問</th>
                    <th className="p-4">回答</th>
                    <th className="p-4">結果</th>
                  </tr>
                </thead>
                <tbody>
                  {histories.map((history) => (
                    <tr key={history.id} className="border-t align-top">
                      <td className="p-4 font-bold text-slate-700">{formatDateTime(history.createdAt)}</td>
                      <td className="p-4">
                        <p className="font-black text-slate-900">{history.user?.name ?? "不明"}</p>
                        <p className="text-xs text-slate-500">{history.user?.email ?? "-"}</p>
                      </td>
                      <td className="p-4 font-bold text-slate-900">{history.question}</td>
                      <td className="p-4 text-slate-600">{history.answer}</td>
                      <td className="p-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${history.matchedFaqId ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}>
                          {history.matchedFaqId ? "FAQ回答" : "回答準備中"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {histories.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center font-bold text-slate-500">問い合わせ履歴はまだありません。</td>
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

function SummaryCard({ label, value, valueClassName = "text-slate-900" }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-black ${valueClassName}`}>{value}</p>
    </div>
  );
}
