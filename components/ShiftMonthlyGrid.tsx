"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type UserRow = {
  id: string;
  no: string;
  name: string;
  department: string;
};

type InitialShift = {
  id: string;
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  patternCode: string | null;
  workPatternId: string | null;
};

type WorkPatternRow = {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  colorClass: string;
  isHoliday: boolean;
};

function toKey(userId: string, date: string) {
  return `${userId}_${date}`;
}

function dayLabel(date: Date) {
  return ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function ShiftMonthlyGrid({
  ym,
  year,
  month,
  dayCount,
  users,
  initialShifts,
  workPatterns
}: {
  ym: string;
  year: number;
  month: number;
  dayCount: number;
  users: UserRow[];
  initialShifts: InitialShift[];
  workPatterns: WorkPatternRow[];
}) {
  const router = useRouter();
  const [selectedPatternId, setSelectedPatternId] = useState(workPatterns[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const patternsById = useMemo(() => {
    return Object.fromEntries(workPatterns.map((pattern) => [pattern.id, pattern]));
  }, [workPatterns]);

  const patternsByCode = useMemo(() => {
    return Object.fromEntries(workPatterns.map((pattern) => [pattern.code, pattern]));
  }, [workPatterns]);

  const days = useMemo(() => {
    return Array.from({ length: dayCount }, (_, i) => {
      const day = i + 1;
      const date = new Date(year, month - 1, day);
      return {
        day,
        date,
        dateStr: `${year}-${pad(month)}-${pad(day)}`,
        label: dayLabel(date),
        isSunday: date.getDay() === 0,
        isSaturday: date.getDay() === 6
      };
    });
  }, [year, month, dayCount]);

  const initialMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const shift of initialShifts) {
      const matchedPattern =
        (shift.workPatternId ? patternsById[shift.workPatternId] : null) ??
        (shift.patternCode ? patternsByCode[shift.patternCode] : null) ??
        workPatterns.find(
          (pattern) =>
            pattern.startTime === shift.startTime &&
            pattern.endTime === shift.endTime &&
            pattern.breakMinutes === shift.breakMinutes
        );

      if (matchedPattern) {
        map[toKey(shift.userId, shift.date)] = matchedPattern.id;
      }
    }
    return map;
  }, [initialShifts, patternsByCode, patternsById, workPatterns]);

  const [cells, setCells] = useState<Record<string, string>>(initialMap);

  function setCell(userId: string, date: string) {
    if (!selectedPatternId) return;
    setCells((prev) => ({
      ...prev,
      [toKey(userId, date)]: selectedPatternId
    }));
  }

  function clearCell(userId: string, date: string) {
    setCells((prev) => {
      const next = { ...prev };
      delete next[toKey(userId, date)];
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setMessage("");

    const shifts = Object.entries(cells)
      .filter(([, patternId]) => patternId && patternsById[patternId])
      .map(([key, patternId]) => {
        const [userId, date] = key.split("_");
        const pattern = patternsById[patternId];
        return {
          userId,
          workDate: date,
          workPatternId: pattern.id,
          patternCode: pattern.code,
          startTime: pattern.startTime,
          endTime: pattern.endTime,
          breakMinutes: pattern.breakMinutes
        };
      });

    const res = await fetch("/api/admin/shifts/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ym, shifts })
    });

    setSaving(false);
    if (res.ok) {
      setMessage("シフトを保存しました。");
      router.refresh();
    } else {
      setMessage("保存に失敗しました。");
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-black">{year}年{month}月 シフト表</h2>
            <p className="text-sm text-slate-500">勤務パターンを選び、セルをクリックして入力します。右クリックで削除できます。</p>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-xl bg-blue-600 px-6 py-3 font-black text-white shadow-sm disabled:opacity-60"
          >
            {saving ? "保存中..." : "一括保存"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {workPatterns.map((pattern) => (
            <button
              key={pattern.id}
              onClick={() => setSelectedPatternId(pattern.id)}
              className={`rounded-xl border px-4 py-2 text-sm font-black ${selectedPatternId === pattern.id ? "border-blue-600 ring-2 ring-blue-100" : "border-slate-200"} ${pattern.colorClass}`}
            >
              {pattern.code} {pattern.name} {pattern.startTime}-{pattern.endTime}
            </button>
          ))}
        </div>

        {workPatterns.length === 0 && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-700">
            勤務パターンマスタに有効なパターンがありません。先に勤務パターンを登録してください。
          </p>
        )}

        {message && <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-700">{message}</p>}
      </section>

      <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="overflow-auto">
          <table className="min-w-[1200px] border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50">
                <th className="sticky left-0 z-20 border bg-slate-50 p-2 text-left">番号</th>
                <th className="sticky left-[54px] z-20 border bg-slate-50 p-2 text-left">氏名</th>
                <th className="sticky left-[180px] z-20 border bg-slate-50 p-2 text-left">所属</th>
                {days.map((d) => (
                  <th key={d.dateStr} className={`border p-1 text-center ${d.isSunday ? "text-red-500" : d.isSaturday ? "text-blue-500" : "text-slate-600"}`}>
                    <div>{d.day}</div>
                    <div>{d.label}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-blue-50/40">
                  <td className="sticky left-0 z-10 border bg-white p-2 font-bold">{user.no}</td>
                  <td className="sticky left-[54px] z-10 min-w-[126px] border bg-white p-2 font-black">{user.name}</td>
                  <td className="sticky left-[180px] z-10 min-w-[110px] border bg-white p-2">{user.department}</td>
                  {days.map((d) => {
                    const patternId = cells[toKey(user.id, d.dateStr)] ?? "";
                    const pattern = patternId ? patternsById[patternId] : null;
                    return (
                      <td key={d.dateStr} className="border p-1 text-center">
                        <button
                          onClick={() => setCell(user.id, d.dateStr)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            clearCell(user.id, d.dateStr);
                          }}
                          title={pattern ? `${pattern.code} ${pattern.name}` : "未設定"}
                          className={`h-10 w-10 rounded-md border text-sm font-black transition hover:scale-105 ${
                            pattern ? pattern.colorClass : "bg-white text-slate-300"
                          }`}
                        >
                          {pattern?.code || ""}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <h3 className="font-black">凡例</h3>
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
          {workPatterns.map((pattern) => (
            <div key={pattern.id} className="flex items-center gap-2">
              <span className={`inline-flex h-8 w-8 items-center justify-center rounded-md border font-black ${pattern.colorClass}`}>
                {pattern.code}
              </span>
              <span className="font-bold text-slate-600">{pattern.name} {pattern.startTime}-{pattern.endTime}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
