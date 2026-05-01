"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type PunchType = "CLOCK_IN" | "CLOCK_OUT" | "BREAK_START" | "BREAK_END";

const punchLabels: Record<PunchType, string> = {
  CLOCK_IN: "出勤",
  CLOCK_OUT: "退勤",
  BREAK_START: "休憩開始",
  BREAK_END: "休憩終了"
};

export function PunchButtons() {
  const router = useRouter();
  const [loading, setLoading] = useState<PunchType | null>(null);
  const [message, setMessage] = useState("");

  async function punch(type: PunchType) {
    if (loading) return;

    setLoading(type);
    setMessage(`${punchLabels[type]}を記録しています...`);

    let latitude: number | null = null;
    let longitude: number | null = null;

    if ("geolocation" in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            maximumAge: 60_000,
            timeout: 1500
          })
        );
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } catch {}
    }

    const res = await fetch("/api/attendance/punch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, latitude, longitude })
    });

    setLoading(null);
    if (res.ok) {
      const data = await res.json();
      setMessage(`${data.label}を記録しました：${data.time}`);
      setTimeout(() => router.refresh(), 300);
    } else {
      setMessage("打刻に失敗しました。");
    }
  }

  const buttonStateClass = loading ? "cursor-wait opacity-70" : "";

  return (
    <section className="rounded-3xl bg-white p-4 shadow-lg">
      <div className="grid grid-cols-1 gap-3">
        <button
          disabled={Boolean(loading)}
          onClick={() => punch("CLOCK_IN")}
          className={`min-h-20 rounded-3xl bg-gradient-to-r from-blue-700 to-blue-500 px-5 py-5 text-xl font-black text-white shadow-md active:scale-[0.99] disabled:active:scale-100 ${buttonStateClass}`}
        >
          {loading === "CLOCK_IN" ? "処理中..." : "出勤打刻"}
        </button>

        <button
          disabled={Boolean(loading)}
          onClick={() => punch("CLOCK_OUT")}
          className={`min-h-20 rounded-3xl bg-gradient-to-r from-red-600 to-rose-500 px-5 py-5 text-xl font-black text-white shadow-md active:scale-[0.99] disabled:active:scale-100 ${buttonStateClass}`}
        >
          {loading === "CLOCK_OUT" ? "処理中..." : "退勤打刻"}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          disabled={Boolean(loading)}
          onClick={() => punch("BREAK_START")}
          className={`rounded-2xl border bg-white px-4 py-4 font-black text-slate-700 shadow-sm active:scale-[0.99] disabled:active:scale-100 ${buttonStateClass}`}
        >
          {loading === "BREAK_START" ? "処理中..." : "休憩開始"}
        </button>

        <button
          disabled={Boolean(loading)}
          onClick={() => punch("BREAK_END")}
          className={`rounded-2xl border bg-white px-4 py-4 font-black text-slate-700 shadow-sm active:scale-[0.99] disabled:active:scale-100 ${buttonStateClass}`}
        >
          {loading === "BREAK_END" ? "処理中..." : "休憩終了"}
        </button>
      </div>

      {message && (
        <p className="mt-3 rounded-2xl bg-blue-50 p-3 text-center text-sm font-bold text-blue-700">
          {message}
        </p>
      )}
    </section>
  );
}
