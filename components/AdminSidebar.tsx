import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";

type MenuItem = {
  href: string;
  label: string;
  key: string;
  icon: string;
};

const mainItems: MenuItem[] = [
  { href: "/admin", label: "ダッシュボード", key: "dashboard", icon: "D" },
  { href: "/admin/monthly", label: "月次勤怠集計", key: "monthly", icon: "月" },
  { href: "/admin/employee-monthly", label: "個人別明細", key: "monthly", icon: "個" },
  { href: "/admin/attendance-analysis", label: "勤怠分析", key: "attendance-analysis", icon: "分" },
  { href: "/admin/shifts", label: "シフト設定", key: "shifts", icon: "シ" },
  { href: "/admin/leaves", label: "休暇申請承認", key: "leaves", icon: "休" },
  { href: "/admin/corrections", label: "打刻修正申請", key: "corrections", icon: "修" },
  { href: "/admin/gps", label: "GPS地図表示", key: "gps", icon: "G" },
  { href: "/admin/employees", label: "社員管理", key: "employees", icon: "社" }
];

const masterItems: MenuItem[] = [
  { href: "/admin/masters", label: "マスタ一覧", key: "masters", icon: "M" },
  { href: "/admin/masters/company", label: "会社マスタ", key: "masters", icon: "会" },
  { href: "/admin/masters/departments", label: "部署マスタ", key: "masters", icon: "部" },
  { href: "/admin/masters/positions", label: "役職マスタ", key: "masters", icon: "役" },
  { href: "/admin/masters/employment-types", label: "雇用区分マスタ", key: "masters", icon: "雇" },
  { href: "/admin/masters/roles", label: "権限マスタ", key: "masters", icon: "権" },
  { href: "/admin/masters/leave-types", label: "休暇種別マスタ", key: "masters", icon: "休" },
  { href: "/admin/masters/work-patterns", label: "勤務パターンマスタ", key: "masters", icon: "勤" }
];

export function AdminSidebar({ active }: { active: string }) {
  const item = ({ href, label, key, icon }: MenuItem) => {
    const isActive = active === key;

    return (
      <Link
        href={href}
        className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-black transition ${
          isActive
            ? "bg-white text-slate-950 shadow-lg shadow-blue-950/20"
            : "text-slate-300 hover:bg-white/10 hover:text-white"
        }`}
      >
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-black ${
            isActive ? "bg-blue-600 text-white" : "bg-white/10 text-slate-200 group-hover:bg-blue-500"
          }`}
        >
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </Link>
    );
  };

  return (
    <aside className="fixed left-0 top-0 hidden h-screen w-64 overflow-hidden bg-slate-950 text-white lg:block">
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-br from-blue-600/35 via-cyan-400/10 to-transparent" />
      <div className="relative flex h-full flex-col">
        <div className="border-b border-white/10 p-5">
          <Link href="/post-login" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-lg font-black shadow-lg shadow-blue-950/30">
              勤
            </span>
            <span>
              <span className="block text-base font-black leading-tight">勤怠管理システム</span>
              <span className="mt-1 block text-xs font-bold text-slate-400">管理コンソール</span>
            </span>
          </Link>
        </div>

        <nav className="relative flex-1 space-y-5 overflow-y-auto p-4">
          <div>
            <div className="mb-2 px-3 text-[11px] font-black tracking-wider text-slate-500">MAIN</div>
            <div className="space-y-1">{mainItems.map((menuItem) => item(menuItem))}</div>
          </div>

          <div>
            <div className="mb-2 px-3 text-[11px] font-black tracking-wider text-slate-500">MASTER</div>
            <div className="space-y-1">{masterItems.map((menuItem) => item(menuItem))}</div>
          </div>
        </nav>

        <div className="relative border-t border-white/10 p-4">
          <Link
            href="/home"
            className="mb-3 flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2.5 text-sm font-black text-slate-200 transition hover:bg-white/10 hover:text-white"
          >
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/10 text-xs">打</span>
            打刻画面へ
          </Link>
          <SignOutButton variant="dark" />
        </div>
      </div>
    </aside>
  );
}
