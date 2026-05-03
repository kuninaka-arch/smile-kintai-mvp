"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PeriodLockButtons({ ym, locked }: { ym: string; locked: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(nextLocked: boolean) {
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/admin/period-lock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ym, locked: nextLocked })
    });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "更新に失敗しました。");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {locked ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => submit(false)}
          className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
        >
          締め解除
        </button>
      ) : (
        <button
          type="button"
          disabled={loading}
          onClick={() => submit(true)}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
        >
          月次締めする
        </button>
      )}
      {message && <span className="text-xs font-bold text-red-600">{message}</span>}
    </div>
  );
}
