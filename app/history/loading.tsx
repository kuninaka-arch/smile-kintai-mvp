import { Nav } from "@/components/Nav";

export default function HistoryLoading() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5">
          <div className="h-8 w-40 animate-pulse rounded-xl bg-slate-200" />
          <div className="mt-3 h-4 w-72 animate-pulse rounded-lg bg-slate-200" />
        </div>

        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3 text-sm font-black text-slate-600">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
            月次集計を取得しています...
          </div>
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="grid gap-3 md:grid-cols-6">
                <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3 text-sm font-black text-slate-600">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
            明細を表示しています...
          </div>
          <div className="space-y-3">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
