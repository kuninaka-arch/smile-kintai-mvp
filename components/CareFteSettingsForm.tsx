"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CareFteSettingsForm({ standardMonthlyMinutes }: { standardMonthlyMinutes: number }) {
  const router = useRouter();
  const [standardMonthlyHours, setStandardMonthlyHours] = useState(String(Math.round(standardMonthlyMinutes / 60)));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const res = await fetch("/api/admin/care/full-time-equivalent/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ standardMonthlyHours })
    });

    setSaving(false);
    if (res.ok) {
      setMessage("常勤換算の基準時間を保存しました。");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "保存に失敗しました。");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block rounded-2xl border bg-slate-50 p-4">
        <span className="text-sm font-black text-slate-700">基準月間時間</span>
        <div className="mt-2 flex items-center gap-3">
          <input
            type="number"
            min="1"
            value={standardMonthlyHours}
            onChange={(e) => setStandardMonthlyHours(e.target.value)}
            className="w-40 rounded-xl border px-3 py-2 text-lg font-black"
          />
          <span className="font-bold text-slate-500">時間</span>
        </div>
      </label>

      <button disabled={saving} className="rounded-xl bg-blue-600 px-5 py-3 font-black text-white disabled:opacity-60">
        {saving ? "保存中..." : "保存する"}
      </button>

      {message && <p className="rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-700">{message}</p>}
    </form>
  );
}
