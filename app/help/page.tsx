import Link from "next/link";
import { AiHelpChat } from "@/components/AiHelpChat";
import { requireAuth } from "@/components/RequireAuth";
import { getAiHelpFaqCards } from "@/lib/ai-help";

export default async function HelpPage() {
  const session = await requireAuth();
  const faqCards = await getAiHelpFaqCards(session.user.companyId);

  return (
    <main className="min-h-screen bg-slate-100 pb-10">
      <header className="bg-gradient-to-br from-blue-700 to-sky-500 px-5 pb-8 pt-5 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between gap-3">
            <Link href="/post-login" className="text-lg font-black">勤怠管理システム</Link>
            <Link href="/post-login" className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold">戻る</Link>
          </div>
          <h1 className="mt-8 text-3xl font-black">AI問い合わせ</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 opacity-90">
            打刻、シフト、休暇、加算資料などの操作について質問できます。まずはFAQを検索し、回答できない質問は管理者確認用に保存します。
          </p>
        </div>
      </header>

      <section className="mx-auto -mt-5 max-w-6xl px-5">
        <AiHelpChat faqCards={faqCards} />
      </section>
    </main>
  );
}
