function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200 ${className}`} />;
}

export default function AdminLoading() {
  return (
    <main className="min-h-screen bg-slate-100">
      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-3">
              <SkeletonBlock className="h-4 w-28" />
              <SkeletonBlock className="h-8 w-56" />
            </div>
            <SkeletonBlock className="h-10 w-32" />
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6">
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-3">
                <SkeletonBlock className="h-5 w-40" />
                <SkeletonBlock className="h-4 w-64 max-w-full" />
              </div>
              <SkeletonBlock className="h-9 w-24" />
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="rounded-2xl bg-slate-50 p-4">
                  <SkeletonBlock className="h-3 w-20" />
                  <SkeletonBlock className="mt-3 h-5 w-full" />
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="border-b p-5">
              <SkeletonBlock className="h-5 w-44" />
            </div>
            <div className="grid gap-3 p-5">
              {Array.from({ length: 6 }).map((_, index) => (
                <SkeletonBlock key={index} className="h-12 w-full" />
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
