import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/components/RequireAuth";
import { AdminSidebar } from "@/components/AdminSidebar";
import { MonthlyTable } from "./MonthlyTable";
import { MonthlyTableSkeleton } from "./MonthlyTableSkeleton";

function parsePage(value?: string) {
  const page = Number(value);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export default async function MonthlyPage({ searchParams }: { searchParams: { ym?: string; department?: string; page?: string } }) {
  const totalStart = Date.now();
  const perfId = Math.random().toString(36).slice(2, 8);
  console.log("[PERF][admin-monthly-shell]", perfId, "total:start");

  const authStart = Date.now();
  const session = await requireAdmin();
  console.log("[PERF][admin-monthly-shell]", perfId, "auth-session", Date.now() - authStart, "ms");

  const parseStart = Date.now();
  const now = new Date();
  const ym = searchParams.ym ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const selectedDepartment = searchParams.department ?? "all";
  const requestedPage = parsePage(searchParams.page);
  console.log("[PERF][admin-monthly-shell]", perfId, "parse-search-params", Date.now() - parseStart, "ms");

  const departmentsStart = Date.now();
  const departmentsSource = await prisma.user.findMany({
    where: { companyId: session.user.companyId },
    select: { department: true },
    orderBy: [{ department: "asc" }, { displayOrder: "asc" }, { createdAt: "asc" }]
  });
  const departments = Array.from(new Set(departmentsSource.map((user) => user.department ?? "-"))).sort();
  console.log("[PERF][admin-monthly-shell]", perfId, "load-departments", Date.now() - departmentsStart, "ms");

  const renderShellStart = Date.now();
  const page = (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="monthly" />

      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-black">勤怠月次集計</h1>
              <p className="text-sm text-slate-500">{ym} の勤怠集計</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <form className="flex flex-wrap gap-2">
                <select name="department" defaultValue={selectedDepartment} className="rounded-xl border px-4 py-2">
                  <option value="all">全従業員</option>
                  {departments.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
                <input name="ym" type="month" defaultValue={ym} className="rounded-xl border px-4 py-2" />
                <button className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white">検索</button>
              </form>
              <Link
                className="rounded-xl bg-green-600 px-4 py-2 font-bold text-white"
                href={`/api/admin/monthly.csv?ym=${ym}&department=${encodeURIComponent(selectedDepartment)}`}
              >
                CSV出力
              </Link>
            </div>
          </div>
        </header>

        <Suspense fallback={<MonthlyTableSkeleton />}>
          <MonthlyTable
            key={`${ym}-${selectedDepartment}-${requestedPage}`}
            companyId={session.user.companyId}
            ym={ym}
            selectedDepartment={selectedDepartment}
            requestedPage={requestedPage}
          />
        </Suspense>
      </section>
    </main>
  );
  console.log("[PERF][admin-monthly-shell]", perfId, "render-shell", Date.now() - renderShellStart, "ms");
  console.log("[PERF][admin-monthly-shell]", perfId, "total", Date.now() - totalStart, "ms");

  return page;
}
