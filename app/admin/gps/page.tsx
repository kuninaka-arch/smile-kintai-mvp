import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/components/RequireAuth";
import { AdminSidebar } from "@/components/AdminSidebar";
import { typeLabel } from "@/lib/attendance";

export default async function GpsPage() {
  const session = await requireAdmin();

  const logs = await prisma.attendanceLog.findMany({
    where: {
      companyId: session.user.companyId,
      latitude: { not: null },
      longitude: { not: null }
    },
    include: { user: true },
    orderBy: { stampedAt: "desc" },
    take: 30
  });

  const latest = logs[0];

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="gps" />
      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto max-w-7xl">
            <h1 className="text-2xl font-black">GPS打刻位置</h1>
            <p className="text-sm text-slate-500">GPSが取得できた打刻の位置を確認できます。</p>
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 xl:grid-cols-[1fr_420px]">
          <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
            {latest ? (
              <iframe
                className="h-[560px] w-full"
                src={`https://maps.google.com/maps?q=${latest.latitude},${latest.longitude}&z=15&output=embed`}
                loading="lazy"
              />
            ) : (
              <div className="flex h-[560px] items-center justify-center text-slate-400">GPS取得済みの打刻がありません</div>
            )}
          </section>

          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-black">最新GPS打刻</h2>
            <div className="space-y-3">
              {logs.map((log) => (
                <a
                  key={log.id}
                  href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
                  target="_blank"
                  className="block rounded-2xl bg-slate-50 p-4 hover:bg-blue-50"
                >
                  <div className="flex justify-between">
                    <p className="font-black">{log.user.name}</p>
                    <p className="text-xs font-bold text-blue-700">{typeLabel(log.type)}</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {log.stampedAt.toLocaleDateString("ja-JP")} {log.stampedAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {log.latitude}, {log.longitude}
                  </p>
                </a>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
