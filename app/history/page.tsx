import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/components/RequireAuth";
import { Nav } from "@/components/Nav";
import { typeLabel } from "@/lib/attendance";

export default async function HistoryPage() {
  const session = await requireAuth();

  const logs = await prisma.attendanceLog.findMany({
    where: { companyId: session.user.companyId, userId: session.user.id },
    orderBy: { stampedAt: "desc" },
    take: 50
  });

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-md px-4 py-6">
        <h1 className="mb-5 text-2xl font-black">打刻履歴</h1>
        <div className="card overflow-hidden">
          {logs.map((log) => (
            <div key={log.id} className="flex items-center justify-between border-b p-4 last:border-b-0">
              <div>
                <p className="font-bold">{typeLabel(log.type)}</p>
                <p className="text-xs text-slate-500">{log.stampedAt.toLocaleDateString("ja-JP")}</p>
              </div>
              <div className="text-right">
                <p className="font-black">{log.stampedAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</p>
                <p className="text-xs text-slate-500">{log.latitude ? "GPSあり" : "GPSなし"}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
