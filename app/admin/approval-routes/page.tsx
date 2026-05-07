import { AdminSidebar } from "@/components/AdminSidebar";
import { ApprovalRouteForm } from "@/components/ApprovalRouteForm";
import { requireAdmin } from "@/components/RequireAuth";
import { prisma } from "@/lib/prisma";

const requestTypeLabels: Record<string, string> = {
  ATTENDANCE_CORRECTION: "打刻修正",
  OVERTIME: "残業",
  HOLIDAY_WORK: "休日出勤",
  NIGHT_WORK: "深夜勤務",
  PAID_LEAVE: "有休",
  SUBSTITUTE_LEAVE: "代休",
  MATERNITY_LEAVE: "産休",
  CHILDCARE_LEAVE: "育休",
  SHORT_TIME_WORK: "時短勤務"
};

export default async function ApprovalRoutesPage() {
  const session = await requireAdmin();
  const [routes, departments, users, roles] = await Promise.all([
    prisma.approvalRoute.findMany({
      where: { companyId: session.user.companyId },
      include: {
        department: { select: { id: true, name: true } },
        steps: {
          include: { approvers: true },
          orderBy: { stepOrder: "asc" }
        }
      },
      orderBy: [{ requestType: "asc" }, { createdAt: "asc" }]
    }),
    prisma.department.findMany({
      where: { companyId: session.user.companyId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, code: true }
    }),
    prisma.user.findMany({
      where: { companyId: session.user.companyId },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, email: true }
    }),
    prisma.roleMaster.findMany({
      where: { companyId: session.user.companyId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, code: true }
    })
  ]);

  const routeValues = routes.map((route) => ({
    id: route.id,
    name: route.name,
    requestType: route.requestType,
    departmentId: route.departmentId,
    description: route.description,
    isDefault: route.isDefault,
    isActive: route.isActive,
    steps: route.steps.map((step) => ({
      stepOrder: step.stepOrder,
      name: step.name,
      requirement: step.requirement,
      approvers: step.approvers.map((approver) => ({
        approverType: approver.approverType,
        userId: approver.userId ?? undefined,
        roleMasterId: approver.roleMasterId ?? undefined,
        departmentId: approver.departmentId ?? undefined
      }))
    }))
  }));

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="approval-routes" />
      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto max-w-7xl">
            <h1 className="text-2xl font-black text-slate-900">承認ルート管理</h1>
            <p className="text-sm text-slate-500">共通申請基盤で利用する会社別・部署別・申請種別別の承認ルートを管理します。</p>
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6">
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-black">新規承認ルート</h2>
            <ApprovalRouteForm departments={departments} users={users} roles={roles} />
          </section>

          <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="border-b p-5">
              <h2 className="text-lg font-black">承認ルート一覧</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="p-4">申請種別</th>
                    <th className="p-4">ルート名</th>
                    <th className="p-4">部署</th>
                    <th className="p-4">ステップ</th>
                    <th className="p-4">状態</th>
                    <th className="p-4">編集</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((route, index) => (
                    <tr key={route.id} className="border-t align-top">
                      <td className="p-4 font-black">{requestTypeLabels[route.requestType] ?? route.requestType}</td>
                      <td className="p-4">
                        <p className="font-black">{route.name}</p>
                        <p className="text-xs text-slate-500">{route.description ?? "-"}</p>
                      </td>
                      <td className="p-4">{route.department?.name ?? "全社共通"}</td>
                      <td className="p-4">
                        <div className="space-y-1">
                          <p className="text-xs font-black text-slate-500">ステップ数: {route.steps.length}</p>
                          {route.steps.map((step) => (
                            <p key={step.id} className="text-xs font-bold text-slate-600">
                              {step.stepOrder}. {step.name} / {step.requirement === "ANY_ONE" ? "誰か1人" : "全員承認"} / {step.approvers.length}件
                            </p>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${route.isActive ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                          {route.isActive ? "有効" : "無効"}
                        </span>
                        {route.isDefault && <span className="ml-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">既定</span>}
                      </td>
                      <td className="p-4">
                        <ApprovalRouteForm route={routeValues[index]} departments={departments} users={users} roles={roles} />
                      </td>
                    </tr>
                  ))}
                  {routes.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-sm font-bold text-slate-400">承認ルートはまだ登録されていません。</td>
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
