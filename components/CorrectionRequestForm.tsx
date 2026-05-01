"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function todayInJapan() {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function CorrectionRequestForm() {
  const router = useRouter();
  const today = todayInJapan();
  const [targetDate, setTargetDate] = useState(today);
  const [requestedType, setRequestedType] = useState("CLOCK_IN");
  const [requestedTime, setRequestedTime] = useState("09:00");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const res = await fetch("/api/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetDate, requestedType, requestedTime, reason })
    });

    if (res.ok) {
      setMessage("修正申請を送信しました。");
      setReason("");
      router.refresh();
    } else {
      setMessage("送信に失敗しました。");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="text-xs font-black text-slate-500">対象日</span>
        <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-black text-slate-500">打刻種別</span>
          <select value={requestedType} onChange={(e) => setRequestedType(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2">
            <option value="CLOCK_IN">出勤</option>
            <option value="CLOCK_OUT">退勤</option>
            <option value="BREAK_START">休憩開始</option>
            <option value="BREAK_END">休憩終了</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-black text-slate-500">希望時刻</span>
          <input type="time" value={requestedTime} onChange={(e) => setRequestedTime(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
        </label>
      </div>
      <label className="block">
        <span className="text-xs font-black text-slate-500">理由</span>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 h-28 w-full rounded-xl border px-3 py-2" placeholder="例：出勤時に打刻を忘れました。" required />
      </label>
      <button className="w-full rounded-xl bg-blue-600 px-4 py-3 font-black text-white">申請する</button>
      {message && <p className="rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-700">{message}</p>}
    </form>
  );
}
