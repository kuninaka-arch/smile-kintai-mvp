import Link from "next/link";
import { requireAdmin } from "@/components/RequireAuth";
import { AdminSidebar } from "@/components/AdminSidebar";

export default async function MastersPage() {
  await requireAdmin();

  const cards = [
    { title: "会社マスタ", desc: "会社名・会社コード・締日などを管理", href: "/admin/masters/company", icon: "🏢" },
    { title: "部署マスタ", desc: "部署コード・部署名・表示順を管理", href: "/admin/masters/departments", icon: "🧩" },
    { title: "雇用区分マスタ", desc: "正社員・パート・アルバイトなどを管理", href: "/admin/masters/employment-types", icon: "👥" },
    { title: "権限マスタ", desc: "管理者・承認者・閲覧のみなどを管理", href: "/admin/masters/roles", icon: "🔐" }
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
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <Link key={card.href} href={card.href} className="group rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-3xl">{card.icon}</div>
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
