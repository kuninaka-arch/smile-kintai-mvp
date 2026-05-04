"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const industryOptions = [
  { value: "general", label: "general（一般）" },
  { value: "care", label: "care（介護施設）" },
  { value: "restaurant", label: "restaurant（飲食店）" },
  { value: "cleaning", label: "cleaning（清掃会社）" },
  { value: "construction", label: "construction（建築業）" }
] as const;

export function CompanyMasterForm({
  company,
  canEditIndustry
}: {
  company: { id: string; name: string; code: string; closingDay: number; industryType: string };
  canEditIndustry: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(company.name);
  const [code, setCode] = useState(company.code);
  const [address, setAddress] = useState("");
  const [tel, setTel] = useState("");
  const [closingDay, setClosingDay] = useState(String(company.closingDay ?? 31));
  const [industryType, setIndustryType] = useState(company.industryType ?? "general");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const res = await fetch("/api/admin/masters/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, code, address, tel, closingDay, industryType })
    });

    if (res.ok) {
      setMessage("会社情報を更新しました。");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "更新に失敗しました。");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="会社コード" value={code} onChange={setCode} />
      <Field label="会社名" value={name} onChange={setName} />
      <Field label="住所（MVP表示用）" value={address} onChange={setAddress} required={false} />
      <Field label="電話番号（MVP表示用）" value={tel} onChange={setTel} required={false} />

      <label className="block">
        <span className="text-xs font-black text-slate-500">業種モード</span>
        <select
          value={industryType}
          onChange={(e) => setIndustryType(e.target.value)}
          disabled={!canEditIndustry}
          className="mt-1 w-full rounded-xl border px-3 py-2 disabled:bg-slate-100 disabled:text-slate-400"
        >
          {industryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs font-bold text-slate-500">
          care を選ぶと管理画面に介護施設メニューが表示されます。general に戻すと非表示になります。
        </p>
        {!canEditIndustry && (
          <p className="mt-1 text-xs font-bold text-red-600">業種モードは system_admin または company_admin のみ変更できます。</p>
        )}
      </label>

      <label className="block">
        <span className="text-xs font-black text-slate-500">締め日</span>
        <select
          value={closingDay}
          onChange={(e) => setClosingDay(e.target.value)}
          className="mt-1 w-full rounded-xl border px-3 py-2"
        >
          <option value="31">月末</option>
          <option value="5">5日</option>
          <option value="10">10日</option>
          <option value="15">15日</option>
          <option value="20">20日</option>
          <option value="25">25日</option>
        </select>
      </label>

      <button className="rounded-xl bg-blue-600 px-5 py-3 font-black text-white">
        保存する
      </button>

      {message && (
        <p className="rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-700">
          {message}
        </p>
      )}
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  required = true
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black text-slate-500">{label}</span>
      <input
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border px-3 py-2"
      />
    </label>
  );
}
