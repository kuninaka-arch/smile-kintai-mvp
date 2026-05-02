import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/components/RequireAuth";
import { AdminSidebar } from "@/components/AdminSidebar";
import { MasterForm } from "@/components/MasterForm";

export default async function LeaveTypesMasterPage() {
  const session = await requireAdmin();
  const items = await prisma.leaveTypeMaster.findMany({
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
            <h1 className="mt-2 text-2xl font-black">休暇種別マスタ</h1>
            <p className="text-sm text-slate-500">有休、代休、特別休暇などの休暇種別を管理します。</p>
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 xl:grid-cols-[420px_1fr]">
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-black">新規登録</h2>
            <MasterForm kind="leaveType" mode="create" />
          </section>

          <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="border-b p-5"><h2 className="text-lg font-black">登録一覧</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="p-4">コード</th>
                    <th className="p-4">名称</th>
                    <th className="p-4">時間単位</th>
                    <th className="p-4">表示順</th>
                    <th className="p-4">状態</th>
                    <th className="p-4">編集</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-4 font-black">{item.code}</td>
                      <td className="p-4">{item.name}</td>
                      <td className="p-4">{item.allowHourly ? "可" : "-"}</td>
                      <td className="p-4">{item.sortOrder}</td>
                      <td className="p-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${item.isActive ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                          {item.isActive ? "有効" : "無効"}
                        </span>
                      </td>
                      <td className="p-4">
                        <MasterForm
                          kind="leaveType"
                          mode="edit"
                          item={{
                            id: item.id,
                            code: item.code,
                            name: item.name,
                            allowHourly: item.allowHourly,
                            sortOrder: item.sortOrder,
                            isActive: item.isActive
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
