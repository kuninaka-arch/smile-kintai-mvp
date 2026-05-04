"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RuleInput = {
  category: "EARLY" | "DAY" | "LATE" | "NIGHT";
  label: string;
  requiredCount: number;
};

export function CareStaffingRulesForm({ rules }: { rules: RuleInput[] }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(rules.map((rule) => [rule.category, rule.requiredCount]))
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const res = await fetch("/api/admin/care/staffing-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: rules.map((rule) => ({
          category: rule.category,
          requiredCount: Number(values[rule.category] ?? 0)
        }))
      })
    });

    setSaving(false);
    if (res.ok) {
      setMessage("人員配置基準を保存しました。");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "保存に失敗しました。");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {rules.map((rule) => (
          <label key={rule.category} className="block rounded-2xl border bg-slate-50 p-4">
            <span className="text-sm font-black text-slate-700">{rule.label} 必要人数</span>
            <input
              type="number"
              min="0"
              value={values[rule.category] ?? 0}
              onChange={(e) => setValues((prev) => ({ ...prev, [rule.category]: Number(e.target.value) }))}
              className="mt-2 w-full rounded-xl border px-3 py-2 text-lg font-black"
            />
          </label>
        ))}
      </div>

      <button disabled={saving} className="rounded-xl bg-blue-600 px-5 py-3 font-black text-white disabled:opacity-60">
        {saving ? "保存中..." : "保存する"}
      </button>

      {message && <p className="rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-700">{message}</p>}
    </form>
  );
}
