"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CorrectionActionButtons({ id, disabled }: { id: string; disabled: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function action(status: "APPROVED" | "REJECTED") {
    setLoading(true);
    await fetch(`/api/admin/corrections/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    setLoading(false);
    router.refresh();
  }

  if (disabled) return <span className="text-xs text-slate-400">処理済み</span>;

  return (
    <div className="flex gap-2">
      <button disabled={loading} onClick={() => action("APPROVED")} className="rounded-xl bg-green-600 px-3 py-2 text-xs font-black text-white">
        承認
      </button>
      <button disabled={loading} onClick={() => action("REJECTED")} className="rounded-xl bg-red-600 px-3 py-2 text-xs font-black text-white">
        却下
      </button>
    </div>
  );
}
