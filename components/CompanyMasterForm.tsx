"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CompanyMasterForm({
  company
}: {
  company: { id: string; name: string; code: string };
}) {
  const router = useRouter();
  const [name, setName] = useState(company.name);
  const [code, setCode] = useState(company.code);
  const [address, setAddress] = useState("");
  const [tel, setTel] = useState("");
  const [closingDay, setClosingDay] = useState("末日");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const res = await fetch("/api/admin/masters/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, code, address, tel, closingDay })
    });

    if (res.ok) {
      setMessage("会社情報を更新しました。");
      router.refresh();
    } else {
      setMessage("更新に失敗しました。");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="会社コード" value={code} onChange={setCode} />
      <Field label="会社名" value={name} onChange={setName} />
      <Field label="住所（MVP表示用）" value={address} onChange={setAddress} required={false} />
      <Field label="電話番号（MVP表示用）" value={tel} onChange={setTel} required={false} />

      <label className="block">
        <span className="text-xs font-black text-slate-500">締日</span>
        <select
          value={closingDay}
          onChange={(e) => setClosingDay(e.target.value)}
          className="mt-1 w-full rounded-xl border px-3 py-2"
        >
          <option>末日</option>
          <option>15日</option>
          <option>20日</option>
          <option>25日</option>
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
