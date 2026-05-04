import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/components/RequireAuth";
import { AdminSidebar } from "@/components/AdminSidebar";
import { CompanyMasterForm } from "@/components/CompanyMasterForm";

export default async function CompanyMasterPage() {
  const session = await requireAdmin();
  const company = await prisma.company.findUniqueOrThrow({ where: { id: session.user.companyId } });
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, roleMaster: { select: { code: true } } }
  });
  const roleCode = currentUser?.roleMaster?.code?.toLowerCase();
  const canEditIndustry = currentUser?.role === "ADMIN" && ["admin", "system_admin", "company_admin"].includes(roleCode ?? "admin");

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="masters" />
      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto max-w-7xl">
            <Link href="/admin/masters" className="text-sm font-bold text-blue-700">← 各種マスタ管理</Link>
            <h1 className="mt-2 text-2xl font-black">会社マスタ</h1>
            <p className="text-sm text-slate-500">会社名・会社コード・締日などを管理します。</p>
          </div>
        </header>
        <div className="mx-auto max-w-3xl px-5 py-6">
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <CompanyMasterForm company={company} canEditIndustry={canEditIndustry} />
          </section>
        </div>
      </section>
    </main>
  );
}
