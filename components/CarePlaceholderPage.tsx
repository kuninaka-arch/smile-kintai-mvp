import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/AdminSidebar";
import { requireAdmin } from "@/components/RequireAuth";
import { isCareCompany } from "@/lib/industry";
import { prisma } from "@/lib/prisma";

type CarePlaceholderPageProps = {
  active: string;
  title: string;
  description: string;
};

export async function CarePlaceholderPage({ active, title, description }: CarePlaceholderPageProps) {
  const session = await requireAdmin();
  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { industryType: true }
  });

  if (!isCareCompany(company?.industryType)) {
    redirect("/admin");
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active={active} />

      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto max-w-7xl">
            <p className="text-sm font-black text-emerald-700">介護施設モード</p>
            <h1 className="text-2xl font-black text-slate-900">{title}</h1>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-6">
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
              <p className="text-sm font-black text-emerald-700">準備中</p>
              <h2 className="mt-2 text-xl font-black text-slate-900">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                今後、夜勤・人員配置・加算資料をこの画面に表示します。既存の勤怠基盤を活かしながら、介護施設向け機能を段階的に追加します。
              </p>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
