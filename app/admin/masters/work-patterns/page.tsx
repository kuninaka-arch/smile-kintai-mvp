import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/components/RequireAuth";
import { AdminSidebar } from "@/components/AdminSidebar";
import { WorkPatternForm } from "@/components/WorkPatternForm";

export default async function WorkPatternsPage() {
  const session = await requireAdmin();

  const items = await prisma.workPattern.findMany({
    where: { companyId: session.user.companyId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="masters" />
      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto max-w-7xl">
            <Link href="/admin/masters" className="text-sm font-bold text-blue-700">← 各種マスタ管理</Link>
            <h1 className="mt-2 text-2xl font-black">勤務パターンマスタ</h1>
            <p className="text-sm text-slate-500">シフト表で使用する A勤・B勤・夜勤・休みなどを管理します。</p>
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 xl:grid-cols-[460px_1fr]">
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-black">新規登録</h2>
            <WorkPatternForm mode="create" />
          </section>

          <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="border-b p-5">
              <h2 className="text-lg font-black">登録一覧</h2>
              <p className="text-sm text-slate-500">ここで登録したパターンが月間シフト表に表示されます。</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="p-4">表示</th>
                    <th className="p-4">コード</th>
                    <th className="p-4">名称</th>
                    <th className="p-4">勤務時間</th>
                    <th className="p-4">休憩</th>
                    <th className="p-4">休日</th>
                    <th className="p-4">状態</th>
                    <th className="p-4">編集</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-4">
                        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-md border font-black ${item.colorClass}`}>
                          {item.code}
                        </span>
                      </td>
                      <td className="p-4 font-black">{item.code}</td>
                      <td className="p-4">{item.name}</td>
                      <td className="p-4">{item.startTime}〜{item.endTime}</td>
                      <td className="p-4">{item.breakMinutes}分</td>
                      <td className="p-4">{item.isHoliday ? "休日扱い" : "-"}</td>
                      <td className="p-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${item.isActive ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                          {item.isActive ? "有効" : "無効"}
                        </span>
                      </td>
                      <td className="p-4">
                        <WorkPatternForm
                          mode="edit"
                          item={{
                            id: item.id,
                            code: item.code,
                            name: item.name,
                            startTime: item.startTime,
                            endTime: item.endTime,
                            breakMinutes: item.breakMinutes,
                            colorClass: item.colorClass,
                            isHoliday: item.isHoliday,
                            sortOrder: item.sortOrder,
                            isActive: item.isActive
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        まだ勤務パターンがありません。まずは A / B / 休 などを登録してください。
                      </td>
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
