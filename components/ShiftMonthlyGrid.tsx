"use client";

import { useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useRouter } from "next/navigation";

type UserRow = {
  id: string;
  no: string;
  name: string;
  position: string;
  department: string;
  actualWorkMinutes: number;
  paidLeaveUsedMinutes: number;
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

type InitialEvent = {
  date: string;
  title: string;
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

function dateStr(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function nthMonday(year: number, month: number, nth: number) {
  let count = 0;
  for (let day = 1; day <= 31; day += 1) {
    const date = new Date(year, month - 1, day);
    if (date.getMonth() !== month - 1) break;
    if (date.getDay() === 1) {
      count += 1;
      if (count === nth) return day;
    }
  }
  return 1;
}

function springEquinoxDay(year: number) {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function autumnEquinoxDay(year: number) {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function japaneseHolidayMap(year: number) {
  const holidays = new Map<string, string>();
  const add = (month: number, day: number, name: string) => holidays.set(dateStr(year, month, day), name);

  add(1, 1, "元日");
  add(1, nthMonday(year, 1, 2), "成人の日");
  add(2, 11, "建国記念の日");
  add(2, 23, "天皇誕生日");
  add(3, springEquinoxDay(year), "春分の日");
  add(4, 29, "昭和の日");
  add(5, 3, "憲法記念日");
  add(5, 4, "みどりの日");
  add(5, 5, "こどもの日");
  add(7, nthMonday(year, 7, 3), "海の日");
  add(8, 11, "山の日");
  add(9, nthMonday(year, 9, 3), "敬老の日");
  add(9, autumnEquinoxDay(year), "秋分の日");
  add(10, nthMonday(year, 10, 2), "スポーツの日");
  add(11, 3, "文化の日");
  add(11, 23, "勤労感謝の日");

  const baseHolidayKeys = Array.from(holidays.keys()).sort();
  for (const key of baseHolidayKeys) {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    if (date.getDay() !== 0) continue;

    let substitute = new Date(y, m - 1, d + 1);
    while (holidays.has(dateStr(substitute.getFullYear(), substitute.getMonth() + 1, substitute.getDate()))) {
      substitute = new Date(substitute.getFullYear(), substitute.getMonth(), substitute.getDate() + 1);
    }
    if (substitute.getFullYear() === year) {
      holidays.set(dateStr(year, substitute.getMonth() + 1, substitute.getDate()), "振替休日");
    }
  }

  for (let month = 1; month <= 12; month += 1) {
    const lastDay = new Date(year, month, 0).getDate();
    for (let day = 2; day < lastDay; day += 1) {
      const key = dateStr(year, month, day);
      if (holidays.has(key)) continue;
      if (holidays.has(dateStr(year, month, day - 1)) && holidays.has(dateStr(year, month, day + 1))) {
        holidays.set(key, "国民の休日");
      }
    }
  }

  return holidays;
}

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function patternWorkMinutes(pattern: WorkPatternRow | null) {
  if (!pattern || pattern.isHoliday) return 0;
  let minutes = timeToMinutes(pattern.endTime) - timeToMinutes(pattern.startTime) - pattern.breakMinutes;
  if (minutes < 0) minutes += 24 * 60;
  return Math.max(0, minutes);
}

function formatHours(minutes: number) {
  const rounded = Math.round(minutes);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function isPaidLeavePattern(pattern: WorkPatternRow | null) {
  if (!pattern) return false;
  return `${pattern.code} ${pattern.name}`.includes("有休") || `${pattern.code} ${pattern.name}`.includes("有給");
}

export function ShiftMonthlyGrid({
  ym,
  year,
  month,
  dayCount,
  users,
  initialShifts,
  workPatterns,
  initialEvents,
  departments
}: {
  ym: string;
  year: number;
  month: number;
  dayCount: number;
  users: UserRow[];
  initialShifts: InitialShift[];
  workPatterns: WorkPatternRow[];
  initialEvents: InitialEvent[];
  departments: string[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPatternId, setSelectedPatternId] = useState(workPatterns[0]?.id ?? "");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");

  const patternsById = useMemo(() => Object.fromEntries(workPatterns.map((pattern) => [pattern.id, pattern])), [workPatterns]);
  const patternsByCode = useMemo(() => Object.fromEntries(workPatterns.map((pattern) => [pattern.code, pattern])), [workPatterns]);
  const holidays = useMemo(() => japaneseHolidayMap(year), [year]);

  const days = useMemo(() => {
    return Array.from({ length: dayCount }, (_, i) => {
      const day = i + 1;
      const date = new Date(year, month - 1, day);
      const key = dateStr(year, month, day);
      const holidayName = holidays.get(key) ?? "";
      return {
        day,
        dateStr: key,
        label: dayLabel(date),
        holidayName,
        isHoliday: Boolean(holidayName),
        isSunday: date.getDay() === 0,
        isSaturday: date.getDay() === 6
      };
    });
  }, [year, month, dayCount, holidays]);

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

      if (matchedPattern) map[toKey(shift.userId, shift.date)] = matchedPattern.id;
    }
    return map;
  }, [initialShifts, patternsByCode, patternsById, workPatterns]);

  const [cells, setCells] = useState<Record<string, string>>(initialMap);

  const initialEventMap = useMemo(() => Object.fromEntries(initialEvents.map((event) => [event.date, event.title])), [initialEvents]);
  const [events, setEvents] = useState<Record<string, string>>(initialEventMap);

  const visibleUsers = useMemo(() => {
    if (selectedDepartment === "all") return users;
    return users.filter((user) => user.department === selectedDepartment);
  }, [selectedDepartment, users]);

  function setEvent(date: string, title: string) {
    setEvents((prev) => ({ ...prev, [date]: title }));
  }

  function getPattern(patternId: string) {
    return patternId ? patternsById[patternId] ?? null : null;
  }

  function monthlyPatternCount(userId: string, patternId: string) {
    return days.filter((day) => cells[toKey(userId, day.dateStr)] === patternId).length;
  }

  function monthlyShiftCount(userId: string) {
    return days.filter((day) => patternWorkMinutes(getPattern(cells[toKey(userId, day.dateStr)] ?? "")) > 0).length;
  }

  function plannedWorkMinutes(userId: string) {
    return days.reduce((sum, day) => sum + patternWorkMinutes(getPattern(cells[toKey(userId, day.dateStr)] ?? "")), 0);
  }

  function plannedPaidLeaveMinutes(userId: string) {
    return days.reduce((sum, day) => {
      const pattern = getPattern(cells[toKey(userId, day.dateStr)] ?? "");
      return sum + (isPaidLeavePattern(pattern) ? 8 * 60 : 0);
    }, 0);
  }

  function dailyPatternCount(date: string, patternId: string) {
    return visibleUsers.filter((user) => cells[toKey(user.id, date)] === patternId).length;
  }

  function setCell(userId: string, date: string) {
    if (!selectedPatternId) return;
    setCells((prev) => ({ ...prev, [toKey(userId, date)]: selectedPatternId }));
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

    const eventRows = Object.entries(events)
      .map(([workDate, title]) => ({ workDate, title: title.trim() }))
      .filter((event) => event.workDate.startsWith(ym));

    const res = await fetch("/api/admin/shifts/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ym, shifts, events: eventRows })
    });

    setSaving(false);
    if (res.ok) {
      setMessage("シフトを保存しました。");
      router.refresh();
    } else {
      setMessage("保存に失敗しました。");
    }
  }

  async function importCsv(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setMessage("シフト表を取り込んでいます...");

    try {
      const buffer = await file.arrayBuffer();
      let text = new TextDecoder("utf-8").decode(buffer);
      if (text.includes("\uFFFD")) text = new TextDecoder("shift_jis").decode(buffer);

      const res = await fetch("/api/admin/shifts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ym, csv: text })
      });

      if (res.ok) {
        setMessage("シフト表を取り込みました。");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error ?? "取込に失敗しました。");
      }
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  function downloadCsv() {
    const metricHeaders = ["勤務時間", "勤務予定時間", "有休消化時間", "有休予定時間"];
    const patternHeaders = workPatterns.map((pattern) => pattern.name);
    const rows: string[][] = [];
    rows.push(["番号", "役職", "氏名", "所属", ...days.map((day) => String(day.day)), ...metricHeaders, "シフト回数", ...patternHeaders]);
    for (const user of visibleUsers) {
      const codes = days.map((day) => getPattern(cells[toKey(user.id, day.dateStr)] ?? "")?.code ?? "");
      rows.push([
        user.no,
        user.position,
        user.name,
        user.department,
        ...codes,
        formatHours(user.actualWorkMinutes),
        formatHours(plannedWorkMinutes(user.id)),
        formatHours(user.paidLeaveUsedMinutes),
        formatHours(plannedPaidLeaveMinutes(user.id)),
        String(monthlyShiftCount(user.id)),
        ...workPatterns.map((pattern) => String(monthlyPatternCount(user.id, pattern.id)))
      ]);
    }

    for (const pattern of workPatterns) {
      rows.push([
        pattern.name,
        "",
        "",
        "",
        ...days.map((day) => String(dailyPatternCount(day.dateStr, pattern.id))),
        "",
        "",
        "",
        "",
        String(visibleUsers.reduce((sum, user) => sum + monthlyPatternCount(user.id, pattern.id), 0)),
        ...workPatterns.map(() => "")
      ]);
    }

    rows.push(["行事", "", "", "", ...days.map((day) => events[day.dateStr] ?? ""), "", "", "", "", "", ...workPatterns.map(() => "")]);

    const csv = "\uFEFF" + rows.map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `shift-${ym}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-black">{year}年{month}月 シフト表</h2>
            <p className="text-sm text-slate-500">勤務パターンを選び、セルをクリックして入力します。右クリックで削除できます。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)} className="rounded-xl border px-4 py-3 text-sm font-bold">
              <option value="all">全従業員</option>
              {departments.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
            <button type="button" onClick={downloadCsv} className="rounded-xl bg-green-600 px-4 py-3 text-sm font-black text-white shadow-sm">
              Excel出力
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white shadow-sm disabled:opacity-60"
            >
              {importing ? "取込中..." : "Excel取込"}
            </button>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={importCsv} className="hidden" />
            <button onClick={save} disabled={saving} className="rounded-xl bg-blue-600 px-6 py-3 font-black text-white shadow-sm disabled:opacity-60">
              {saving ? "保存中..." : "一括保存"}
            </button>
          </div>
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

        {message && <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-700">{message}</p>}
      </section>

      <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="overflow-auto">
          <table className="min-w-max table-fixed border-collapse text-xs">
            <colgroup>
              <col className="w-[54px]" />
              <col className="w-[90px]" />
              <col className="w-[126px]" />
              <col className="w-[110px]" />
              {days.map((d) => (
                <col key={d.dateStr} className="w-[58px]" />
              ))}
              <col className="w-[96px]" />
              <col className="w-[112px]" />
              <col className="w-[112px]" />
              <col className="w-[112px]" />
              <col className="w-[86px]" />
              {workPatterns.map((pattern) => (
                <col key={pattern.id} className="w-[86px]" />
              ))}
            </colgroup>
            <thead>
              <tr className="bg-slate-50">
                <th className="sticky left-0 z-20 w-[54px] min-w-[54px] border bg-slate-50 p-2 text-left">番号</th>
                <th className="sticky left-[54px] z-20 w-[90px] min-w-[90px] border bg-slate-50 p-2 text-left">役職</th>
                <th className="sticky left-[144px] z-20 w-[126px] min-w-[126px] border bg-slate-50 p-2 text-left">氏名</th>
                <th className="sticky left-[270px] z-20 w-[110px] min-w-[110px] border bg-slate-50 p-2 text-left">所属</th>
                {days.map((d) => (
                  <th
                    key={d.dateStr}
                    title={d.holidayName || undefined}
                    className={`w-[58px] min-w-[58px] border p-1 text-center ${d.isHoliday || d.isSunday ? "bg-red-50 text-red-600" : d.isSaturday ? "bg-blue-50 text-blue-600" : "text-slate-600"}`}
                  >
                    <div>{d.day}</div>
                    <div>{d.label}</div>
                    {d.isHoliday && <div className="text-[10px] font-black">祝</div>}
                  </th>
                ))}
                <th className="border bg-slate-50 p-2 text-center">勤務時間</th>
                <th className="border bg-slate-50 p-2 text-center">勤務予定時間</th>
                <th className="border bg-slate-50 p-2 text-center">有休消化時間</th>
                <th className="border bg-slate-50 p-2 text-center">有休予定時間</th>
                <th className="border bg-slate-50 p-2 text-center">シフト回数</th>
                {workPatterns.map((pattern) => (
                  <th key={pattern.id} className="border bg-slate-50 p-2 text-center">{pattern.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user) => (
                <tr key={user.id} className="hover:bg-blue-50/40">
                  <td className="sticky left-0 z-10 w-[54px] min-w-[54px] border bg-white p-2 font-bold">{user.no}</td>
                  <td className="sticky left-[54px] z-10 w-[90px] min-w-[90px] border bg-white p-2">{user.position || "-"}</td>
                  <td className="sticky left-[144px] z-10 w-[126px] min-w-[126px] border bg-white p-2 font-black">{user.name}</td>
                  <td className="sticky left-[270px] z-10 w-[110px] min-w-[110px] border bg-white p-2">{user.department}</td>
                  {days.map((d) => {
                    const patternId = cells[toKey(user.id, d.dateStr)] ?? "";
                    const pattern = getPattern(patternId);
                    return (
                      <td key={d.dateStr} className="w-[58px] min-w-[58px] border p-1 text-center">
                        <button
                          onClick={() => setCell(user.id, d.dateStr)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            clearCell(user.id, d.dateStr);
                          }}
                          title={pattern ? `${pattern.code} ${pattern.name}` : "未設定"}
                          className={`h-10 w-10 rounded-md border text-sm font-black transition hover:scale-105 ${pattern ? pattern.colorClass : "bg-white text-slate-300"}`}
                        >
                          {pattern?.code || ""}
                        </button>
                      </td>
                    );
                  })}
                  <td className="border bg-slate-50 p-2 text-center font-black">{formatHours(user.actualWorkMinutes)}</td>
                  <td className="border bg-slate-50 p-2 text-center font-black">{formatHours(plannedWorkMinutes(user.id))}</td>
                  <td className="border bg-slate-50 p-2 text-center font-black">{formatHours(user.paidLeaveUsedMinutes)}</td>
                  <td className="border bg-slate-50 p-2 text-center font-black">{formatHours(plannedPaidLeaveMinutes(user.id))}</td>
                  <td className="border bg-blue-50 p-2 text-center text-sm font-black text-blue-700">{monthlyShiftCount(user.id)}</td>
                  {workPatterns.map((pattern) => (
                    <td key={pattern.id} className="border bg-blue-50/60 p-2 text-center font-black text-blue-700">
                      {monthlyPatternCount(user.id, pattern.id)}
                    </td>
                  ))}
                </tr>
              ))}
              {workPatterns.map((pattern) => (
                <tr key={pattern.id} className="bg-slate-50">
                  <td className="sticky left-0 z-10 border bg-slate-50 p-2 font-black" colSpan={4}>{pattern.name}</td>
                  {days.map((d) => (
                    <td key={d.dateStr} className="w-[58px] min-w-[58px] border p-2 text-center text-sm font-black text-slate-700">
                      {dailyPatternCount(d.dateStr, pattern.id)}
                    </td>
                  ))}
                  <td className="border p-2" colSpan={4} />
                  <td className="border p-2 text-center text-sm font-black text-blue-700">
                    {visibleUsers.reduce((sum, user) => sum + monthlyPatternCount(user.id, pattern.id), 0)}
                  </td>
                  {workPatterns.map((summaryPattern) => (
                    <td key={summaryPattern.id} className="border p-2 text-center text-sm font-black text-blue-700">
                      {summaryPattern.id === pattern.id
                        ? visibleUsers.reduce((sum, user) => sum + monthlyPatternCount(user.id, pattern.id), 0)
                        : ""}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-amber-50">
                <td className="sticky left-0 z-10 border bg-amber-50 p-2 font-black" colSpan={4}>行事</td>
                {days.map((d) => (
                  <td key={d.dateStr} className="w-[58px] min-w-[58px] border p-1 align-top">
                    <textarea
                      value={events[d.dateStr] ?? ""}
                      onChange={(e) => setEvent(d.dateStr, e.target.value)}
                      className="h-28 w-12 resize-none rounded border bg-white px-1 py-2 text-center text-xs font-bold [writing-mode:vertical-rl]"
                      placeholder="行事"
                    />
                  </td>
                ))}
                <td className="border bg-amber-50 p-2" colSpan={5 + workPatterns.length} />
              </tr>
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
