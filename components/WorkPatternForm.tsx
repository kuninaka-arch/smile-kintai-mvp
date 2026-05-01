"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const colorOptions = [
  { label: "緑", value: "bg-emerald-400 text-slate-900" },
  { label: "黄緑", value: "bg-green-300 text-slate-900" },
  { label: "オレンジ", value: "bg-orange-300 text-slate-900" },
  { label: "青", value: "bg-sky-400 text-white" },
  { label: "紺", value: "bg-blue-500 text-white" },
  { label: "赤文字", value: "bg-white text-red-500" },
  { label: "グレー", value: "bg-slate-200 text-slate-700" }
];

type WorkPatternItem = {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  colorClass: string;
  isHoliday: boolean;
  sortOrder: number;
  isActive: boolean;
};

export function WorkPatternForm({
  mode,
  item
}: {
  mode: "create" | "edit";
  item?: WorkPatternItem;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(mode === "create");
  const [code, setCode] = useState(item?.code ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [startTime, setStartTime] = useState(item?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(item?.endTime ?? "18:00");
  const [breakMinutes, setBreakMinutes] = useState(String(item?.breakMinutes ?? 60));
  const [colorClass, setColorClass] = useState(item?.colorClass ?? "bg-emerald-400 text-slate-900");
  const [isHoliday, setIsHoliday] = useState(item?.isHoliday ?? false);
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [message, setMessage] = useState("");

  function changeHoliday(nextIsHoliday: boolean) {
    setIsHoliday(nextIsHoliday);
    if (nextIsHoliday) {
      setStartTime("00:00");
      setEndTime("00:00");
      setBreakMinutes("0");
      setColorClass("bg-slate-200 text-slate-700");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const res = await fetch(mode === "create" ? "/api/admin/masters/work-patterns" : `/api/admin/masters/work-patterns/${item?.id}`, {
      method: mode === "create" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        name,
        startTime,
        endTime,
        breakMinutes: Number(breakMinutes),
        colorClass,
        isHoliday,
        sortOrder: Number(sortOrder),
        isActive
      })
    });

    if (res.ok) {
      setMessage(mode === "create" ? "勤務パターンを登録しました。" : "勤務パターンを更新しました。");
      router.refresh();
      if (mode === "edit") setOpen(false);
      if (mode === "create") {
        setCode("");
        setName("");
      }
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "保存に失敗しました。");
    }
  }

  if (mode === "edit" && !open) {
    return <button onClick={() => setOpen(true)} className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-black">編集</button>;
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {mode === "edit" && (
        <div className="mb-3 flex items-center justify-between">
          <p className="font-black">編集</p>
          <button type="button" onClick={() => setOpen(false)} className="text-xs font-bold text-slate-400">閉じる</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="コード" value={code} onChange={setCode} />
        <Field label="名称" value={name} onChange={setName} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="開始" value={startTime} onChange={setStartTime} type="time" />
        <Field label="終了" value={endTime} onChange={setEndTime} type="time" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="休憩分" value={breakMinutes} onChange={setBreakMinutes} type="number" />
        <Field label="表示順" value={sortOrder} onChange={setSortOrder} type="number" />
      </div>

      <label className="block">
        <span className="text-xs font-black text-slate-500">表示色</span>
        <select value={colorClass} onChange={(e) => setColorClass(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2">
          {colorOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </label>

      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-bold">
          <input type="checkbox" checked={isHoliday} onChange={(e) => changeHoliday(e.target.checked)} />
          休日扱い
        </label>
        <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-bold">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          有効
        </label>
      </div>

      <button className="w-full rounded-xl bg-blue-600 px-4 py-3 font-black text-white">
        {mode === "create" ? "登録する" : "更新する"}
      </button>

      {message && <p className="rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-700">{message}</p>}
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black text-slate-500">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" required />
    </label>
  );
}
