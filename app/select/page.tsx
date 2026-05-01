import Link from "next/link";

export default function SelectPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-5 py-10">
      <section className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-3xl text-white">☺</div>
          <h1 className="text-3xl font-black text-blue-700">勤怠管理システム</h1>
          <p className="mt-2 text-sm text-slate-500">表示する画面を選択してください。</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/home" className="rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <p className="text-sm font-bold text-blue-700">打刻</p>
            <h2 className="mt-2 text-2xl font-black">打刻画面</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">出勤・退勤・休憩の打刻、履歴確認、修正申請を行います。</p>
            <span className="mt-6 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white">打刻画面を開く</span>
          </Link>

          <Link href="/admin" className="rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <p className="text-sm font-bold text-slate-700">管理</p>
            <h2 className="mt-2 text-2xl font-black">管理画面</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">社員・シフト・勤怠集計・各種マスタを管理します。</p>
            <span className="mt-6 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">管理画面を開く</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
