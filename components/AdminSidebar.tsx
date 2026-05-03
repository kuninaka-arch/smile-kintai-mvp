import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";

type IconName =
  | "dashboard"
  | "calendar"
  | "userDetail"
  | "chart"
  | "shifts"
  | "leave"
  | "edit"
  | "map"
  | "users"
  | "database"
  | "building"
  | "departments"
  | "badge"
  | "briefcase"
  | "shield"
  | "clock"
  | "punch";

type MenuItem = {
  href: string;
  label: string;
  key: string;
  icon: IconName;
};

const mainItems: MenuItem[] = [
  { href: "/admin", label: "ダッシュボード", key: "dashboard", icon: "dashboard" },
  { href: "/admin/monthly", label: "月次勤怠集計", key: "monthly", icon: "calendar" },
  { href: "/admin/employee-monthly", label: "個人別明細", key: "monthly", icon: "userDetail" },
  { href: "/admin/attendance-analysis", label: "勤怠分析", key: "attendance-analysis", icon: "chart" },
  { href: "/admin/shifts", label: "シフト設定", key: "shifts", icon: "shifts" },
  { href: "/admin/leaves", label: "休暇申請承認", key: "leaves", icon: "leave" },
  { href: "/admin/corrections", label: "打刻修正申請", key: "corrections", icon: "edit" },
  { href: "/admin/gps", label: "GPS地図表示", key: "gps", icon: "map" },
  { href: "/admin/employees", label: "社員管理", key: "employees", icon: "users" }
];

const masterItems: MenuItem[] = [
  { href: "/admin/masters", label: "マスタ一覧", key: "masters", icon: "database" },
  { href: "/admin/masters/company", label: "会社マスタ", key: "masters", icon: "building" },
  { href: "/admin/masters/departments", label: "部署マスタ", key: "masters", icon: "departments" },
  { href: "/admin/masters/positions", label: "役職マスタ", key: "masters", icon: "badge" },
  { href: "/admin/masters/employment-types", label: "雇用区分マスタ", key: "masters", icon: "briefcase" },
  { href: "/admin/masters/roles", label: "権限マスタ", key: "masters", icon: "shield" },
  { href: "/admin/masters/leave-types", label: "休暇種別マスタ", key: "masters", icon: "leave" },
  { href: "/admin/masters/work-patterns", label: "勤務パターンマスタ", key: "masters", icon: "clock" }
];

function MenuIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, JSX.Element> = {
    dashboard: (
      <>
        <path d="M4 13h6V4H4v9Z" />
        <path d="M14 20h6V4h-6v16Z" />
        <path d="M4 20h6v-3H4v3Z" />
      </>
    ),
    calendar: (
      <>
        <path d="M7 3v3" />
        <path d="M17 3v3" />
        <path d="M4 8h16" />
        <path d="M5 5h14v15H5V5Z" />
      </>
    ),
    userDetail: (
      <>
        <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path d="M4 20a5 5 0 0 1 10 0" />
        <path d="M16 8h4" />
        <path d="M16 12h4" />
        <path d="M16 16h3" />
      </>
    ),
    chart: (
      <>
        <path d="M4 19h16" />
        <path d="M7 16v-5" />
        <path d="M12 16V6" />
        <path d="M17 16v-8" />
      </>
    ),
    shifts: (
      <>
        <path d="M5 4h14v16H5V4Z" />
        <path d="M5 9h14" />
        <path d="M10 4v16" />
        <path d="M14 13h2" />
      </>
    ),
    leave: (
      <>
        <path d="M6 4h12v16H6V4Z" />
        <path d="M9 8h6" />
        <path d="M9 12h6" />
        <path d="M9 16h3" />
      </>
    ),
    edit: (
      <>
        <path d="M5 19h4l10-10-4-4L5 15v4Z" />
        <path d="M13 7l4 4" />
      </>
    ),
    map: (
      <>
        <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" />
        <path d="M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
      </>
    ),
    users: (
      <>
        <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path d="M16 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
        <path d="M3 20a5 5 0 0 1 10 0" />
        <path d="M13 18a4 4 0 0 1 7 2" />
      </>
    ),
    database: (
      <>
        <path d="M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3Z" />
        <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
        <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
      </>
    ),
    building: (
      <>
        <path d="M5 21V4h10v17" />
        <path d="M15 9h4v12" />
        <path d="M8 8h3" />
        <path d="M8 12h3" />
        <path d="M8 16h3" />
      </>
    ),
    departments: (
      <>
        <path d="M12 5v4" />
        <path d="M6 13v3" />
        <path d="M18 13v3" />
        <path d="M6 13h12" />
        <path d="M9 5h6v4H9V5Z" />
        <path d="M3 16h6v4H3v-4Z" />
        <path d="M15 16h6v4h-6v-4Z" />
      </>
    ),
    badge: (
      <>
        <path d="M8 4h8l2 5-6 12L6 9l2-5Z" />
        <path d="M9 9h6" />
      </>
    ),
    briefcase: (
      <>
        <path d="M9 6V4h6v2" />
        <path d="M4 7h16v12H4V7Z" />
        <path d="M4 12h16" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />
        <path d="m9 12 2 2 4-5" />
      </>
    ),
    clock: (
      <>
        <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    punch: (
      <>
        <path d="M7 3h10v18H7V3Z" />
        <path d="M10 7h4" />
        <path d="M10 11h4" />
        <path d="M12 17h.01" />
      </>
    )
  };

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      {paths[name]}
    </svg>
  );
}

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
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
            isActive ? "bg-blue-600 text-white" : "bg-white/10 text-slate-200 group-hover:bg-blue-500"
          }`}
        >
          <MenuIcon name={icon} />
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
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-950/30">
              <MenuIcon name="clock" />
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
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/10">
              <MenuIcon name="punch" />
            </span>
            打刻画面へ
          </Link>
          <SignOutButton variant="dark" />
        </div>
      </div>
    </aside>
  );
}
