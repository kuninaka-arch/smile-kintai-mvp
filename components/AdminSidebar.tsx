import Link from "next/link";

export function AdminSidebar({ active }: { active: string }) {
  const item = (href: string, label: string, key: string) => (
    <Link
      href={href}
      className={`block rounded-2xl px-4 py-3 ${
        active === key ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-white/10"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <aside className="fixed left-0 top-0 hidden h-screen w-64 bg-slate-950 text-white lg:block">
      <div className="border-b border-white/10 p-6">
        <div className="text-xl font-black">☺ 勤怠管理システム</div>
        <p className="mt-1 text-xs text-slate-400">管理者画面</p>
      </div>
      <nav className="space-y-1 overflow-y-auto p-4 text-sm font-bold">
        {item("/admin", "ダッシュボード", "dashboard")}
        {item("/admin/monthly", "月次勤怠集計", "monthly")}
        {item("/admin/attendance-analysis", "勤怠分析", "attendance-analysis")}
        {item("/admin/employees", "社員管理", "employees")}
        {item("/admin/shifts", "シフト設定", "shifts")}
        {item("/admin/corrections", "打刻修正申請", "corrections")}
        {item("/admin/gps", "GPS地図表示", "gps")}
        {item("/admin/masters", "各種マスタ管理", "masters")}
        <div className="px-4 pt-3 text-[11px] font-black uppercase tracking-wider text-slate-500">マスタ</div>
        {item("/admin/masters/company", "会社マスタ", "masters")}
        {item("/admin/masters/departments", "部署マスタ", "masters")}
        {item("/admin/masters/employment-types", "雇用区分マスタ", "masters")}
        {item("/admin/masters/roles", "権限マスタ", "masters")}
        {item("/admin/masters/work-patterns", "勤務パターンマスタ", "masters")}
        {item("/home", "打刻画面", "home")}
      </nav>
    </aside>
  );
}
