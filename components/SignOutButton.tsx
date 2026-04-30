"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button onClick={() => signOut({ callbackUrl: "/login" })} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold">
      ログアウト
    </button>
  );
}
