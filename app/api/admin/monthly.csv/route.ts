import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { minutesToHHMM } from "@/lib/attendance";
import { getPeriodLock } from "@/lib/period-lock";
import { summarizeMonthlyAttendance } from "@/lib/monthly-attendance";

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const ym = url.searchParams.get("ym") ?? new Date().toISOString().slice(0, 7);
  const selectedDepartment = url.searchParams.get("department") ?? "all";
  const period = await getPeriodLock(session.user.companyId, ym);
  const start = period.periodStart;
  const end = period.periodEndExclusive;

  const users = await prisma.user.findMany({
    where: {
      companyId: session.user.companyId,
      ...(selectedDepartment === "all" ? {} : { department: selectedDepartment === "-" ? null : selectedDepartment })
    },
    include: {
      attendanceLogs: {
        where: { stampedAt: { gte: start, lt: end } },
        orderBy: { stampedAt: "asc" }
      },
      shifts: {
        where: { workDate: { gte: start, lt: end } },
        include: { workPattern: true },
        orderBy: { workDate: "asc" }
      },
      paidLeaves: true,
      leaveRequests: {
        where: { status: "APPROVED", targetDate: { gte: start, lt: end } },
        include: { leaveType: true }
      }
    },
    orderBy: [{ department: "asc" }, { displayOrder: "asc" }, { createdAt: "asc" }]
  });

  const lines = [[
    "氏名",
    "所属",
    "出勤日数",
    "欠勤日数",
    "総労働時間",
    "勤務予定時間",
    "普通残業時間",
    "深夜残業時間",
    "休日出勤時間",
    "休日深夜時間",
    "遅刻早退時間",
    "休暇時間",
    "夜勤回数",
    "準夜勤回数",
    "宿直回数",
    "有給残日数"
  ]];

  for (const user of users) {
    const metrics = summarizeMonthlyAttendance({
      logs: user.attendanceLogs,
      shifts: user.shifts,
      leaves: user.leaveRequests
    });
    const leave = user.paidLeaves[0];

    lines.push([
      user.name,
      user.department ?? "",
      `${metrics.workDays}日`,
      `${metrics.absenceDays}日`,
      minutesToHHMM(metrics.actualWorkMinutes),
      minutesToHHMM(metrics.scheduledWorkMinutes),
      minutesToHHMM(metrics.regularOvertimeMinutes),
      minutesToHHMM(metrics.nightOvertimeMinutes),
      minutesToHHMM(metrics.holidayWorkMinutes),
      minutesToHHMM(metrics.holidayNightWorkMinutes),
      minutesToHHMM(metrics.lateEarlyMinutes),
      minutesToHHMM(metrics.leaveMinutes),
      `${metrics.nightShiftCount}回`,
      `${metrics.semiNightShiftCount}回`,
      `${metrics.lodgingShiftCount}回`,
      leave ? `${leave.grantedDays - leave.usedDays}日` : "0日"
    ]);
  }

  const csv = lines.map((row) => row.map(csvEscape).join(",")).join("\n");

  return new Response("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="monthly-attendance-${ym}.csv"`
    }
  });
}
