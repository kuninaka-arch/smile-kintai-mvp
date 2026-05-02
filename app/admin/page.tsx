import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/components/RequireAuth";
import { formatJaDate, formatJaTime, typeLabel } from "@/lib/attendance";
import { AdminSidebar } from "@/components/AdminSidebar";

export default async function AdminDashboard({ searchParams }: { searchParams: { department?: string } }) {
  const session = await requireAdmin();
  const selectedDepartment = searchParams.department ?? "all";

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const users = await prisma.user.findMany({
    where: { companyId: session.user.companyId },
    include: {
      attendanceLogs: {
        where: { stampedAt: { gte: todayStart, lt: todayEnd } },
        orderBy: { stampedAt: "desc" }
      },
      paidLeaves: true
    },
    orderBy: { createdAt: "asc" }
  }).catch(() => []);

  const departments = Array.from(new Set(users.map((user) => user.department ?? "-"))).sort();
  const visibleUsers = selectedDepartment === "all"
    ? users
    : users.filter((user) => (user.department ?? "-") === selectedDepartment);

  const totalUsers = visibleUsers.length;
  const clockedIn = visibleUsers.filter((u) => u.attendanceLogs.some((l) => l.type === "CLOCK_IN")).length;
  const working = visibleUsers.filter((u) => {
    const latest = u.attendanceLogs[0];
    return latest?.type === "CLOCK_IN" || latest?.type === "BREAK_END";
  }).length;
  const breakNow = visibleUsers.filter((u) => u.attendanceLogs[0]?.type === "BREAK_START").length;
  const notClocked = totalUsers - clockedIn;

  const menuItems = [
    {
      title: "社員追加・編集",
      desc: "社員登録・所属・権限を管理",
      href: "/admin/employees",
      icon: "👥",
      color: "from-blue-600 to-sky-500"
    },
    {
      title: "シフト設定",
      desc: "月間シフト表を登録・編集",
      href: "/admin/shifts",
      icon: "📅",
      color: "from-indigo-600 to-blue-500"
    },
    {
      title: "打刻修正申請",
      desc: "社員からの申請を承認・却下",
      href: "/admin/corrections",
      icon: "📝",
      color: "from-orange-500 to-amber-400"
    },
    {
      title: "GPS地図表示",
      desc: "打刻位置を地図で確認",
      href: "/admin/gps",
      icon: "📍",
      color: "from-emerald-600 to-teal-400"
    },
    {
      title: "各種マスタ管理",
      desc: "会社・部署・雇用区分・権限を管理",
      href: "/admin/masters",
      icon: "⚙️",
      color: "from-slate-800 to-slate-600"
    },
    {
      title: "月次勤怠集計",
      desc: "労働時間・残業時間・CSV出力",
      href: "/admin/monthly",
      icon: "📊",
      color: "from-purple-600 to-fuchsia-500"
    }
  ];

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="dashboard" />

      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-bold text-blue-700">管理者ダッシュボード</p>
              <h1 className="text-2xl font-black">本日の勤怠状況</h1>
              <p className="text-sm text-slate-500">{formatJaDate(todayStart)} の出勤状況を確認できます。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/masters" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">
                各種マスタ管理
              </Link>
              <Link href="/admin/monthly" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white">
                月次集計
              </Link>
              <Link href="/home" className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">
                打刻画面
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto flex max-w-7xl flex-col px-5 py-6">
          <section className="mb-6 rounded-[2rem] bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 p-6 text-white shadow-sm">
            <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
              <div>
                <p className="text-sm font-bold text-white/80">Smile Kintai Admin</p>
                <h2 className="mt-2 text-3xl font-black">今日の状況をひと目で確認</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
                  出勤状況、未打刻、休憩中スタッフ、管理メニューをこの画面からすぐ確認できます。
                </p>
              </div>
              <div className="rounded-3xl bg-white/15 p-4 backdrop-blur">
                <p className="text-sm text-white/80">本日の出勤率</p>
                <p className="mt-2 text-4xl font-black">{totalUsers ? Math.round((clockedIn / totalUsers) * 100) : 0}%</p>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full rounded-full bg-white" style={{ width: `${totalUsers ? Math.round((clockedIn / totalUsers) * 100) : 0}%` }} />
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <KpiCard label="社員数" value={`${totalUsers}名`} sub="登録社員" color="text-slate-900" />
            <KpiCard label="本日出勤" value={`${clockedIn}名`} sub="出勤打刻済み" color="text-blue-700" />
            <KpiCard label="勤務中" value={`${working}名`} sub="現在勤務中" color="text-green-700" />
            <KpiCard label="休憩中" value={`${breakNow}名`} sub="休憩打刻中" color="text-orange-600" />
            <KpiCard label="未打刻" value={`${notClocked}名`} sub="出勤未確認" color="text-red-600" />
          </div>

          <section className="order-3 mt-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black">管理メニュー</h2>
                <p className="text-sm text-slate-500">よく使う管理機能へすぐ移動できます。</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group overflow-hidden rounded-3xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className={`h-2 bg-gradient-to-r ${item.color}`} />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-3xl">
                        {item.icon}
                      </div>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 group-hover:bg-blue-600 group-hover:text-white">
                        開く
                      </span>
                    </div>
                    <h3 className="mt-4 text-lg font-black group-hover:text-blue-700">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{item.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <div className="order-2 mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
            <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-black">本日のスタッフ一覧</h2>
                  <p className="text-sm text-slate-500">最新打刻、勤務状態、GPS取得状況を確認できます。</p>
                </div>
                <form className="flex flex-wrap items-center gap-2">
                  <select
                    name="department"
                    defaultValue={selectedDepartment}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm"
                  >
                    <option value="all">全従業員</option>
                    {departments.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                  <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm">
                    表示
                  </button>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                    {visibleUsers.length}名
                  </span>
                </form>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-500">
                    <tr>
                      <th className="p-4">社員</th>
                      <th className="p-4">所属</th>
                      <th className="p-4">状態</th>
                      <th className="p-4">最新打刻</th>
                      <th className="p-4">時刻</th>
                      <th className="p-4">GPS</th>
                      <th className="p-4">有給残</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleUsers.map((user) => {
                      const latest = user.attendanceLogs[0];
                      const status = getStatus(latest?.type);
                      const leave = user.paidLeaves[0];
                      const leaveRemain = leave ? leave.grantedDays - leave.usedDays : 0;

                      return (
                        <tr key={user.id} className="border-t hover:bg-slate-50">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-black text-blue-700">
                                {user.name.slice(0, 1)}
                              </div>
                              <div>
                                <p className="font-black">{user.name}</p>
                                <p className="text-xs text-slate-400">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">{user.department ?? "-"}</td>
                          <td className="p-4">
                            <span className={`rounded-full px-3 py-1 text-xs font-black ${status.className}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="p-4">{latest ? typeLabel(latest.type) : "-"}</td>
                          <td className="p-4 font-bold">
                            {latest ? formatJaTime(latest.stampedAt) : "-"}
                          </td>
                          <td className="p-4">
                            {latest?.latitude ? (
                              <span className="text-xs font-bold text-green-700">取得済み</span>
                            ) : (
                              <span className="text-xs text-slate-400">なし</span>
                            )}
                          </td>
                          <td className="p-4 font-bold">{leaveRemain}日</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-6">
              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black">本日の状況</h2>
                <div className="mt-5 space-y-4">
                  <Progress label="出勤率" value={totalUsers ? Math.round((clockedIn / totalUsers) * 100) : 0} />
                  <Progress label="勤務中" value={totalUsers ? Math.round((working / totalUsers) * 100) : 0} />
                  <Progress label="未打刻" value={totalUsers ? Math.round((notClocked / totalUsers) * 100) : 0} danger />
                </div>
              </div>

              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black">ショートカット</h2>
                <div className="mt-4 grid gap-2">
                  <Link href="/admin/masters" className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 hover:bg-blue-50 hover:text-blue-700">
                    各種マスタ管理 →
                  </Link>
                  <Link href="/admin/shifts" className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 hover:bg-blue-50 hover:text-blue-700">
                    シフト設定 →
                  </Link>
                  <Link href="/admin/monthly" className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 hover:bg-blue-50 hover:text-blue-700">
                    月次勤怠集計 →
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className={`mt-3 text-4xl font-black ${color}`}>{value}</p>
      <p className="mt-2 text-xs text-slate-400">{sub}</p>
    </div>
  );
}

function Progress({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm font-bold">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${danger ? "bg-red-500" : "bg-blue-600"}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function getStatus(type?: string) {
  if (type === "CLOCK_IN" || type === "BREAK_END") {
    return { label: "勤務中", className: "bg-green-50 text-green-700" };
  }
  if (type === "BREAK_START") {
    return { label: "休憩中", className: "bg-orange-50 text-orange-700" };
  }
  if (type === "CLOCK_OUT") {
    return { label: "退勤済み", className: "bg-slate-100 text-slate-600" };
  }
  return { label: "未打刻", className: "bg-red-50 text-red-600" };
}
