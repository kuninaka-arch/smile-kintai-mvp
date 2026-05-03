import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { calcDailyWorkMinutes, dateToJaMinutes, formatJaTime, minutesToHHMM, toJaDateKey } from "@/lib/attendance";

type Status = "OK" | "LATE" | "EARLY" | "MISSING_IN" | "MISSING_OUT" | "NO_SHIFT";

function tokyoDateRange(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00+09:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function statusLabel(status: Status) {
  switch (status) {
    case "OK": return "正常";
    case "LATE": return "遅刻";
    case "EARLY": return "早退";
    case "MISSING_IN": return "出勤未打刻";
    case "MISSING_OUT": return "退勤未打刻";
    case "NO_SHIFT": return "シフトなし";
  }
}

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const todayStr = toJaDateKey(new Date());
  const dateStr = url.searchParams.get("date") ?? todayStr;
  const graceMinutes = Number(url.searchParams.get("grace") ?? 5);
  const { start: targetStart, end: targetEnd } = tokyoDateRange(dateStr);

  const users = await prisma.user.findMany({
    where: { companyId: session.user.companyId },
    include: {
      shifts: {
        where: { workDate: { gte: targetStart, lt: targetEnd } },
        include: { workPattern: true }
      },
      attendanceLogs: {
        where: { stampedAt: { gte: targetStart, lt: targetEnd } },
        orderBy: { stampedAt: "asc" }
      }
    },
    orderBy: [{ department: "asc" }, { displayOrder: "asc" }, { createdAt: "asc" }]
  });

  const lines = [[
    "日付",
    "氏名",
    "所属",
    "判定",
    "予定",
    "出勤実績",
    "退勤実績",
    "実働",
    "遅刻分",
    "早退分",
    "GPS"
  ]];

  for (const user of users) {
    const shift = user.shifts[0];
    const logs = user.attendanceLogs;
    const clockIn = logs.find((log) => log.type === "CLOCK_IN");
    const clockOut = [...logs].reverse().find((log) => log.type === "CLOCK_OUT");
    const workMinutes = calcDailyWorkMinutes(logs);

    let status: Status = "OK";
    let lateMinutes = 0;
    let earlyMinutes = 0;

    if (!shift || (shift.startTime === "00:00" && shift.endTime === "00:00")) {
      status = "NO_SHIFT";
    } else if (!clockIn) {
      status = "MISSING_IN";
    } else if (!clockOut) {
      status = "MISSING_OUT";
      lateMinutes = Math.max(0, dateToJaMinutes(clockIn.stampedAt) - toMinutes(shift.startTime));
      if (lateMinutes > graceMinutes) status = "LATE";
    } else {
      lateMinutes = Math.max(0, dateToJaMinutes(clockIn.stampedAt) - toMinutes(shift.startTime));
      earlyMinutes = Math.max(0, toMinutes(shift.endTime) - dateToJaMinutes(clockOut.stampedAt));
      if (lateMinutes > graceMinutes) status = "LATE";
      else if (earlyMinutes > graceMinutes) status = "EARLY";
    }

    lines.push([
      dateStr,
      user.name,
      user.department ?? "",
      statusLabel(status),
      shift ? `${shift.startTime}-${shift.endTime}` : "",
      clockIn ? formatJaTime(clockIn.stampedAt) : "",
      clockOut ? formatJaTime(clockOut.stampedAt) : "",
      minutesToHHMM(workMinutes),
      String(lateMinutes),
      String(earlyMinutes),
      clockIn?.latitude ? `${clockIn.latitude},${clockIn.longitude}` : ""
    ]);
  }

  const csv = lines.map((row) => row.map(csvEscape).join(",")).join("\n");

  return new Response("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance-analysis-${dateStr}.csv"`
    }
  });
}
