import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/components/RequireAuth";
import { AdminSidebar } from "@/components/AdminSidebar";
import { EmployeeForm } from "@/components/EmployeeForm";

export default async function EmployeesPage({ searchParams }: { searchParams: { department?: string; q?: string } }) {
  const session = await requireAdmin();
  const selectedDepartment = searchParams.department ?? "all";
  const q = (searchParams.q ?? "").trim();

  const [users, roleMasters, positions] = await Promise.all([
    prisma.user.findMany({
      where: { companyId: session.user.companyId },
      include: { roleMaster: true, positionMaster: true },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }]
    }),
    prisma.roleMaster.findMany({
      where: { companyId: session.user.companyId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    }),
    prisma.positionMaster.findMany({
      where: { companyId: session.user.companyId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    })
  ]);

  const roleMasterOptions = roleMasters.map((roleMaster) => ({
    id: roleMaster.id,
    code: roleMaster.code,
    name: roleMaster.name
  }));

  const positionOptions = positions.map((position) => ({
    id: position.id,
    code: position.code,
    name: position.name
  }));

  const departments = Array.from(new Set(users.map((user) => user.department ?? "-"))).sort();
  const filteredUsers = users.filter((user) => {
    const matchesDepartment = selectedDepartment === "all" || (user.department ?? "-") === selectedDepartment;
    const keyword = q.toLowerCase();
    const matchesKeyword = !keyword || user.name.toLowerCase().includes(keyword) || user.email.toLowerCase().includes(keyword);
    return matchesDepartment && matchesKeyword;
  });

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="employees" />
      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto max-w-7xl">
            <h1 className="text-2xl font-black">社員管理</h1>
            <p className="text-sm text-slate-500">社員の追加、編集、権限、役職を管理します。</p>
            <form className="mt-4 flex flex-wrap gap-2">
              <select name="department" defaultValue={selectedDepartment} className="rounded-xl border px-4 py-2">
                <option value="all">全従業員</option>
                {departments.map((department) => (
                  <option key={department} value={department}>{department}</option>
                ))}
              </select>
              <input name="q" defaultValue={q} placeholder="氏名・メール検索" className="rounded-xl border px-4 py-2" />
              <button className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white">検索</button>
            </form>
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 xl:grid-cols-[420px_1fr]">
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-black">社員を追加</h2>
            <EmployeeForm mode="create" roleMasters={roleMasterOptions} positions={positionOptions} />
          </section>

          <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="border-b p-5">
              <h2 className="text-lg font-black">社員一覧</h2>
              <p className="text-sm text-slate-500">{filteredUsers.length}名を表示中</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="p-4">氏名</th>
                    <th className="p-4">表示順</th>
                    <th className="p-4">メール</th>
                    <th className="p-4">所属</th>
                    <th className="p-4">役職</th>
                    <th className="p-4">職種</th>
                    <th className="p-4">常勤</th>
                    <th className="p-4">権限</th>
                    <th className="p-4">編集</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-t">
                      <td className="p-4 font-black">{user.name}</td>
                      <td className="p-4 font-black text-slate-500">{user.displayOrder}</td>
                      <td className="p-4">{user.email}</td>
                      <td className="p-4">{user.department ?? "-"}</td>
                      <td className="p-4">{user.positionMaster?.name ?? "-"}</td>
                      <td className="p-4">{user.jobType ?? "-"}</td>
                      <td className="p-4">{user.isFullTime ? "常勤" : "非常勤"}</td>
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
                            displayOrder: user.displayOrder,
                            role: user.role,
                            roleMasterId: user.roleMasterId,
                            positionMasterId: user.positionMasterId,
                            jobType: user.jobType,
                            isFullTime: user.isFullTime,
                            monthlyScheduledMinutes: user.monthlyScheduledMinutes
                          }}
                          roleMasters={roleMasterOptions}
                          positions={positionOptions}
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
