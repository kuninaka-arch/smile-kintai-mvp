"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type LeaveTypeOption = {
  id: string;
  name: string;
  allowHourly: boolean;
};

function todayInJapan() {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`;
}

export function LeaveRequestForm({ leaveTypes }: { leaveTypes: LeaveTypeOption[] }) {
  const router = useRouter();
  const [leaveTypeId, setLeaveTypeId] = useState(leaveTypes[0]?.id ?? "");
  const [targetDate, setTargetDate] = useState(todayInJapan());
  const [unit, setUnit] = useState<"FULL_DAY" | "HOUR">("FULL_DAY");
  const [hours, setHours] = useState("1");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");

  const selectedLeaveType = leaveTypes.find((leaveType) => leaveType.id === leaveTypeId);
  const canUseHourly = Boolean(selectedLeaveType?.allowHourly);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const res = await fetch("/api/leaves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaveTypeId, targetDate, unit, hours: Number(hours), reason })
    });

    if (res.ok) {
      setMessage("休暇申請を送信しました。");
      setReason("");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "送信に失敗しました。");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="text-xs font-black text-slate-500">休暇種別</span>
        <select value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" required>
          {leaveTypes.map((leaveType) => (
            <option key={leaveType.id} value={leaveType.id}>{leaveType.name}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-black text-slate-500">対象日</span>
        <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" required />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-black text-slate-500">取得単位</span>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as "FULL_DAY" | "HOUR")}
            className="mt-1 w-full rounded-xl border px-3 py-2"
          >
            <option value="FULL_DAY">1日</option>
            {canUseHourly && <option value="HOUR">時間</option>}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-black text-slate-500">時間数</span>
          <input
            type="number"
            min="0.5"
            step="0.5"
            value={hours}
            disabled={unit !== "HOUR"}
            onChange={(e) => setHours(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 disabled:bg-slate-100"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-black text-slate-500">理由</span>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 h-28 w-full rounded-xl border px-3 py-2" required />
      </label>

      <button className="w-full rounded-xl bg-blue-600 px-4 py-3 font-black text-white">申請する</button>
      {message && <p className="rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-700">{message}</p>}
    </form>
  );
}
