"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ShiftForm({ users, date }: { users: { id: string; name: string }[]; date: string }) {
  const router = useRouter();
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [workDate, setWorkDate] = useState(date);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [breakMinutes, setBreakMinutes] = useState("60");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const res = await fetch("/api/admin/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, workDate, startTime, endTime, breakMinutes: Number(breakMinutes) })
    });

    if (res.ok) {
      setMessage("シフトを登録しました。");
      router.refresh();
    } else {
      setMessage("登録に失敗しました。");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="text-xs font-black text-slate-500">社員</span>
        <select value={userId} onChange={(e) => setUserId(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2">
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="text-xs font-black text-slate-500">勤務日</span>
        <input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-black text-slate-500">開始</span>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-xs font-black text-slate-500">終了</span>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
        </label>
      </div>
      <label className="block">
        <span className="text-xs font-black text-slate-500">休憩分</span>
        <input type="number" value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
      </label>
      <button className="w-full rounded-xl bg-blue-600 px-4 py-3 font-black text-white">登録する</button>
      {message && <p className="rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-700">{message}</p>}
    </form>
  );
}
