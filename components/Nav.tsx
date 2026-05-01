import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";

export async function Nav() {
  const session = await getServerSession(authOptions);

  return (
    <nav className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/home" className="font-black text-blue-700">☺ 勤怠管理システム</Link>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/history" className="font-bold text-slate-600">履歴</Link>
          {session?.user.role === "ADMIN" && (
            <>
              <Link href="/admin" className="font-bold text-slate-600">管理</Link>
              <Link href="/admin/monthly" className="font-bold text-slate-600">月次</Link>
            </>
          )}
          <SignOutButton />
        </div>
      </div>
    </nav>
  );
}
