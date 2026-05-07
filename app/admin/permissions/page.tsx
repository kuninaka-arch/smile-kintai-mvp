import { AdminSidebar } from "@/components/AdminSidebar";
import { PermissionsManager } from "@/components/PermissionsManager";
import { requireAdmin } from "@/components/RequireAuth";
import { prisma } from "@/lib/prisma";

export default async function PermissionsPage() {
  const session = await requireAdmin();
  const [roles, users, departments, rolePermissions, userDepartmentPermissions] = await Promise.all([
    prisma.roleMaster.findMany({
      where: { companyId: session.user.companyId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, code: true, name: true }
    }),
    prisma.user.findMany({
      where: { companyId: session.user.companyId },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, email: true }
    }),
    prisma.department.findMany({
      where: { companyId: session.user.companyId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true }
    }),
    prisma.rolePermission.findMany({
      where: { companyId: session.user.companyId },
      orderBy: [{ roleMasterId: "asc" }, { feature: "asc" }]
    }),
    prisma.userDepartmentPermission.findMany({
      where: { companyId: session.user.companyId },
      orderBy: [{ createdAt: "desc" }]
    })
  ]);

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="permissions" />
      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto max-w-7xl">
            <h1 className="text-2xl font-black text-slate-900">権限管理</h1>
            <p className="text-sm text-slate-500">既存のADMIN/EMPLOYEEを残したまま、ロール別機能権限とユーザー別部署スコープを管理します。</p>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-6">
          <PermissionsManager
            roles={roles}
            users={users}
            departments={departments}
            rolePermissions={rolePermissions}
            userDepartmentPermissions={userDepartmentPermissions}
          />
        </div>
      </section>
    </main>
  );
}
