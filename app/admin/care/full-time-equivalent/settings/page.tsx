import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/AdminSidebar";
import { CareFteSettingsForm } from "@/components/CareFteSettingsForm";
import { requireAdmin } from "@/components/RequireAuth";
import { isCareCompany } from "@/lib/industry";
import { prisma } from "@/lib/prisma";

const defaultStandardMinutes = 160 * 60;

export default async function CareFteSettingsPage() {
  const session = await requireAdmin();
  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { industryType: true }
  });

  if (!isCareCompany(company?.industryType)) {
    redirect("/admin");
  }

  const rule = await prisma.careFullTimeEquivalentRule.findFirst({
    where: { companyId: session.user.companyId },
    orderBy: { updatedAt: "desc" }
  });

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="care-fte" />

      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto max-w-7xl">
            <p className="text-sm font-black text-emerald-700">介護施設モード</p>
            <h1 className="text-2xl font-black text-slate-900">常勤換算 基準設定</h1>
            <p className="mt-1 text-sm text-slate-500">常勤換算で割り戻す基準月間時間を設定します。</p>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-6">
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <h2 className="text-lg font-black text-slate-900">基準時間</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                初期値は160時間です。施設の運用基準に合わせて変更できます。
              </p>
            </div>
            <CareFteSettingsForm standardMonthlyMinutes={rule?.standardMonthlyMinutes ?? defaultStandardMinutes} />
          </section>
        </div>
      </section>
    </main>
  );
}
