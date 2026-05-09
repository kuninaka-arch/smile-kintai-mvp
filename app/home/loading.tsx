export default function HomeLoading() {
  return (
    <main className="min-h-screen bg-slate-100 pb-24">
      <header className="bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 px-5 pb-8 pt-5 text-white">
        <div className="mx-auto max-w-md">
          <div className="h-7 w-48 animate-pulse rounded-xl bg-white/20" />
          <div className="mt-8 rounded-3xl bg-white/15 p-5 shadow-lg backdrop-blur">
            <div className="flex items-center gap-3 text-sm font-black">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              読み込み中です...
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="h-20 animate-pulse rounded-2xl bg-white/15" />
              <div className="h-20 animate-pulse rounded-2xl bg-white/15" />
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto -mt-5 max-w-md px-5">
        <div className="h-40 rounded-3xl bg-white p-5 shadow-sm">
          <div className="h-full animate-pulse rounded-2xl bg-slate-100" />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="h-24 animate-pulse rounded-3xl bg-white shadow-sm" />
          <div className="h-24 animate-pulse rounded-3xl bg-white shadow-sm" />
          <div className="h-24 animate-pulse rounded-3xl bg-white shadow-sm" />
        </div>
      </section>
    </main>
  );
}
