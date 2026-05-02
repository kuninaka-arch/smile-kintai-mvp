import Link from "next/link";
import { requireAdmin } from "@/components/RequireAuth";
import { AdminSidebar } from "@/components/AdminSidebar";

export default async function MastersPage() {
  await requireAdmin();

  const cards = [
    { title: "会社マスタ", desc: "会社名や会社コードを管理します。", href: "/admin/masters/company", icon: "会" },
    { title: "部署マスタ", desc: "部署コード、部署名、表示順を管理します。", href: "/admin/masters/departments", icon: "部" },
    { title: "役職マスタ", desc: "社員に付与する役職を管理します。", href: "/admin/masters/positions", icon: "役" },
    { title: "雇用区分マスタ", desc: "正社員、パート、アルバイトなどを管理します。", href: "/admin/masters/employment-types", icon: "雇" },
    { title: "権限マスタ", desc: "管理者、社員などの権限を管理します。", href: "/admin/masters/roles", icon: "権" },
    { title: "休暇種別マスタ", desc: "有休、代休、特別休暇などを管理します。", href: "/admin/masters/leave-types", icon: "休" }
  ];

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="masters" />
      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto max-w-7xl">
            <h1 className="text-2xl font-black">各種マスタ管理</h1>
            <p className="text-sm text-slate-500">勤怠管理システムの基本情報を管理します。</p>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-6">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <Link key={card.href} href={card.href} className="group rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-xl font-black text-blue-700">{card.icon}</div>
                <h2 className="mt-5 text-xl font-black group-hover:text-blue-700">{card.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{card.desc}</p>
                <div className="mt-5 text-sm font-black text-blue-700">管理する →</div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
