import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/components/RequireAuth";
import { AdminSidebar } from "@/components/AdminSidebar";
import { EmployeeForm } from "@/components/EmployeeForm";

export default async function EmployeesPage() {
  const session = await requireAdmin();

  const [users, roleMasters] = await Promise.all([
    prisma.user.findMany({
      where: { companyId: session.user.companyId },
      include: { roleMaster: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.roleMaster.findMany({
      where: { companyId: session.user.companyId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    })
  ]);

  const roleMasterOptions = roleMasters.map((roleMaster) => ({
    id: roleMaster.id,
    code: roleMaster.code,
    name: roleMaster.name
  }));

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="employees" />
      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto max-w-7xl">
            <h1 className="text-2xl font-black">社員管理</h1>
            <p className="text-sm text-slate-500">社員の追加・編集ができます。</p>
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 xl:grid-cols-[420px_1fr]">
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-black">社員を追加</h2>
            <EmployeeForm mode="create" roleMasters={roleMasterOptions} />
          </section>

          <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="border-b p-5">
              <h2 className="text-lg font-black">社員一覧</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="p-4">氏名</th>
                    <th className="p-4">メール</th>
                    <th className="p-4">所属</th>
                    <th className="p-4">権限</th>
                    <th className="p-4">編集</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-t">
                      <td className="p-4 font-black">{user.name}</td>
                      <td className="p-4">{user.email}</td>
                      <td className="p-4">{user.department ?? "-"}</td>
                      <td className="p-4">
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                          {user.roleMaster?.name ?? (user.role === "ADMIN" ? "管理者" : "社員")}
                        </span>
                      </td>
                      <td className="p-4">
                        <EmployeeForm
                          mode="edit"
                          user={{
                            id: user.id,
                            name: user.name,
                            email: user.email,
                            department: user.department ?? "",
                            role: user.role,
                            roleMasterId: user.roleMasterId
                          }}
                          roleMasters={roleMasterOptions}
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
