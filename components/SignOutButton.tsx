"use client";

import { signOut } from "next-auth/react";

export function SignOutButton({ variant = "light" }: { variant?: "light" | "dark" }) {
  const className =
    variant === "dark"
      ? "w-full rounded-2xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm font-black text-white transition hover:bg-red-500 hover:text-white"
      : "rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white transition hover:bg-red-600";

  return (
    <button onClick={() => signOut({ callbackUrl: "/login" })} className={className}>
      ログアウト
    </button>
  );
}
