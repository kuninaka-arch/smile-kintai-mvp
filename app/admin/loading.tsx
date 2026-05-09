export default function AdminLoading() {
  return (
    <main className="min-h-screen bg-slate-100">
      <section className="lg:ml-64">
        <div className="flex min-h-screen items-center justify-center px-5 py-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            <div>
              <p className="text-base font-black text-slate-900">読み込み中...</p>
              <p className="mt-1 text-sm font-bold text-slate-500">管理画面を表示しています</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
