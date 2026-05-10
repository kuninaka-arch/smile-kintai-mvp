export function MonthlyTableSkeleton() {
  const rows = Array.from({ length: 8 });

  return (
    <div className="mx-auto max-w-7xl px-5 py-6">
      <section className="mb-6 rounded-3xl bg-white p-5 shadow-sm">
        <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-7 w-48 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded bg-slate-100" />
      </section>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
            <div className="mt-4 h-8 w-20 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="border-b p-5">
          <h2 className="text-lg font-black text-slate-900">月次データを読み込み中...</h2>
          <p className="mt-1 text-sm text-slate-500">社員別の月次集計を取得しています。</p>
        </div>
        <div className="max-h-[68vh] overflow-hidden">
          <div className="min-w-[1680px] divide-y divide-slate-100">
            {rows.map((_, index) => (
              <div key={index} className="grid grid-cols-8 gap-4 px-4 py-4">
                {Array.from({ length: 8 }).map((__, cellIndex) => (
                  <div key={cellIndex} className="h-4 animate-pulse rounded bg-slate-100" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
