"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  defaultWorkPatternFlags,
  normalizeWorkPatternCategory,
  workPatternCategories,
  type WorkPatternCategoryValue
} from "@/lib/work-pattern-category";

const colorOptions = [
  { label: "緑", value: "bg-emerald-400 text-slate-900", displayColor: "emerald" },
  { label: "薄緑", value: "bg-green-300 text-slate-900", displayColor: "green" },
  { label: "オレンジ", value: "bg-orange-300 text-slate-900", displayColor: "orange" },
  { label: "水色", value: "bg-sky-400 text-white", displayColor: "sky" },
  { label: "青", value: "bg-blue-500 text-white", displayColor: "blue" },
  { label: "紫", value: "bg-violet-300 text-slate-900", displayColor: "violet" },
  { label: "赤文字", value: "bg-white text-red-500", displayColor: "red" },
  { label: "グレー", value: "bg-slate-200 text-slate-700", displayColor: "slate" }
];

type WorkPatternItem = {
  id: string;
  code: string;
  name: string;
  category: WorkPatternCategoryValue;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  colorClass: string;
  displayColor: string;
  isHoliday: boolean;
  isNightShift: boolean;
  autoCreateAfterNight: boolean;
  countsAsWork: boolean;
  countsAsLeave: boolean;
  sortOrder: number;
  isActive: boolean;
};

export function WorkPatternForm({
  mode,
  item,
  showCareFields = false
}: {
  mode: "create" | "edit";
  item?: WorkPatternItem;
  showCareFields?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(mode === "create");
  const [code, setCode] = useState(item?.code ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState<WorkPatternCategoryValue>(item?.category ?? "DAY");
  const [startTime, setStartTime] = useState(item?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(item?.endTime ?? "18:00");
  const [breakMinutes, setBreakMinutes] = useState(String(item?.breakMinutes ?? 60));
  const [colorClass, setColorClass] = useState(item?.colorClass ?? "bg-emerald-400 text-slate-900");
  const [displayColor, setDisplayColor] = useState(item?.displayColor ?? "emerald");
  const [isHoliday, setIsHoliday] = useState(item?.isHoliday ?? false);
  const [isNightShift, setIsNightShift] = useState(item?.isNightShift ?? false);
  const [autoCreateAfterNight, setAutoCreateAfterNight] = useState(item?.autoCreateAfterNight ?? false);
  const [countsAsWork, setCountsAsWork] = useState(item?.countsAsWork ?? true);
  const [countsAsLeave, setCountsAsLeave] = useState(item?.countsAsLeave ?? false);
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [message, setMessage] = useState("");

  function applyCategory(nextCategory: WorkPatternCategoryValue) {
    const flags = defaultWorkPatternFlags(nextCategory);
    setCategory(nextCategory);
    setIsHoliday(flags.isHoliday);
    setIsNightShift(flags.isNightShift);
    setAutoCreateAfterNight(flags.autoCreateAfterNight);
    setCountsAsWork(flags.countsAsWork);
    setCountsAsLeave(flags.countsAsLeave);

    if (!flags.countsAsWork) {
      setStartTime("00:00");
      setEndTime("00:00");
      setBreakMinutes("0");
      setColorClass(nextCategory === "PAID_LEAVE" ? "bg-amber-200 text-slate-900" : "bg-slate-200 text-slate-700");
      setDisplayColor(nextCategory === "PAID_LEAVE" ? "amber" : "slate");
    }
  }

  function changeHoliday(nextIsHoliday: boolean) {
    setIsHoliday(nextIsHoliday);
    if (nextIsHoliday) {
      setStartTime("00:00");
      setEndTime("00:00");
      setBreakMinutes("0");
      setColorClass("bg-slate-200 text-slate-700");
      setDisplayColor("slate");
      if (showCareFields && category === "DAY") {
        applyCategory("OFF");
      }
    }
  }

  function changeColor(nextColorClass: string) {
    const option = colorOptions.find((color) => color.value === nextColorClass);
    setColorClass(nextColorClass);
    setDisplayColor(option?.displayColor ?? "custom");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const normalizedCategory = normalizeWorkPatternCategory(category);
    const res = await fetch(mode === "create" ? "/api/admin/masters/work-patterns" : `/api/admin/masters/work-patterns/${item?.id}`, {
      method: mode === "create" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        name,
        category: normalizedCategory,
        startTime,
        endTime,
        breakMinutes: Number(breakMinutes),
        colorClass,
        displayColor,
        isHoliday,
        isNightShift,
        autoCreateAfterNight,
        countsAsWork,
        countsAsLeave,
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

      {showCareFields && (
        <label className="block">
          <span className="text-xs font-black text-slate-500">勤務区分</span>
          <select value={category} onChange={(e) => applyCategory(e.target.value as WorkPatternCategoryValue)} className="mt-1 w-full rounded-xl border px-3 py-2">
            {workPatternCategories.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="開始" value={startTime} onChange={setStartTime} type="time" />
        <Field label="終了" value={endTime} onChange={setEndTime} type="time" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="休憩 分" value={breakMinutes} onChange={setBreakMinutes} type="number" />
        <Field label="表示順" value={sortOrder} onChange={setSortOrder} type="number" />
      </div>

      <label className="block">
        <span className="text-xs font-black text-slate-500">表示色</span>
        <select value={colorClass} onChange={(e) => changeColor(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2">
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

      {showCareFields && (
        <div className="grid gap-2 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-slate-700">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isNightShift} onChange={(e) => setIsNightShift(e.target.checked)} />
            夜勤として扱う
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={autoCreateAfterNight} onChange={(e) => setAutoCreateAfterNight(e.target.checked)} />
            夜勤翌日に明けを自動作成する
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={countsAsWork} onChange={(e) => setCountsAsWork(e.target.checked)} />
            勤務時間に含める
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={countsAsLeave} onChange={(e) => setCountsAsLeave(e.target.checked)} />
            休暇時間に含める
          </label>
        </div>
      )}

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
