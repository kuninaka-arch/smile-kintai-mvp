"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LeaveActionButtons({
  id,
  disabled,
  hasExistingShift = false
}: {
  id: string;
  disabled: boolean;
  hasExistingShift?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function action(status: "APPROVED" | "REJECTED") {
    const overwriteExistingShift =
      status === "APPROVED" &&
      hasExistingShift &&
      window.confirm("既存シフトがあります。\n承認済み休暇で既存シフトを上書きしますか？");

    if (status === "APPROVED" && hasExistingShift && !overwriteExistingShift) return;

    setLoading(true);
    await fetch(`/api/admin/leaves/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, overwriteExistingShift })
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
