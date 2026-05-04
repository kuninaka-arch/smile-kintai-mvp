import { redirect } from "next/navigation";
import { WorkPatternCategory } from "@prisma/client";
import { AdminSidebar } from "@/components/AdminSidebar";
import { CareStaffingRulesForm } from "@/components/CareStaffingRulesForm";
import { requireAdmin } from "@/components/RequireAuth";
import { isCareCompany } from "@/lib/industry";
import { prisma } from "@/lib/prisma";

const staffingCategories = [
  { category: WorkPatternCategory.EARLY, label: "早番" },
  { category: WorkPatternCategory.DAY, label: "日勤" },
  { category: WorkPatternCategory.LATE, label: "遅番" },
  { category: WorkPatternCategory.NIGHT, label: "夜勤" }
] as const;

export default async function CareStaffingRulesPage() {
  const session = await requireAdmin();
  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { industryType: true }
  });

  if (!isCareCompany(company?.industryType)) {
    redirect("/admin");
  }

  const savedRules = await prisma.careStaffingRule.findMany({
    where: {
      companyId: session.user.companyId,
      category: { in: staffingCategories.map((item) => item.category) },
      floorId: null,
      departmentId: null
    }
  });
  const requiredCountByCategory = new Map(savedRules.map((rule) => [rule.category, rule.requiredCount]));

  const rules = staffingCategories.map((item) => ({
    category: item.category,
    label: item.label,
    requiredCount: requiredCountByCategory.get(item.category) ?? 0
  }));

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="care-staffing-rules" />

      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto max-w-7xl">
            <p className="text-sm font-black text-emerald-700">介護施設モード</p>
            <h1 className="text-2xl font-black text-slate-900">人員配置基準設定</h1>
            <p className="mt-1 text-sm text-slate-500">
              早番・日勤・遅番・夜勤ごとに、1日に必要な人数を設定します。
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-6">
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <h2 className="text-lg font-black text-slate-900">会社共通の配置基準</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                今回は会社全体の基準として保存します。フロア別・部署別の基準は後続フェーズで拡張できる形にしています。
              </p>
            </div>
            <CareStaffingRulesForm rules={rules} />
          </section>
        </div>
      </section>
    </main>
  );
}
