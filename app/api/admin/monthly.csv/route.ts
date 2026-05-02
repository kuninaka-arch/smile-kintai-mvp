import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { calcDailyWorkMinutes, minutesToHHMM, toJaDateKey } from "@/lib/attendance";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const ym = url.searchParams.get("ym") ?? new Date().toISOString().slice(0, 7);
  const [year, month] = ym.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const users = await prisma.user.findMany({
    where: { companyId: session.user.companyId },
    include: {
      attendanceLogs: {
        where: { stampedAt: { gte: start, lt: end } },
        orderBy: { stampedAt: "asc" }
      },
      leaveRequests: {
        where: { status: "APPROVED", targetDate: { gte: start, lt: end } },
        include: { leaveType: true }
      }
    }
  });

  const lines = [["氏名", "所属", "出勤日数", "総労働時間", "残業時間", "休暇取得時間"]];

  for (const user of users) {
    const byDate = new Map<string, typeof user.attendanceLogs>();
    for (const log of user.attendanceLogs) {
      const key = toJaDateKey(log.stampedAt);
      byDate.set(key, [...(byDate.get(key) ?? []), log]);
    }

    let days = 0;
    let total = 0;
    byDate.forEach((logs) => {
      const min = calcDailyWorkMinutes(logs);
      if (min > 0) days += 1;
      total += min;
    });

    const overtime = Math.max(0, total - days * 8 * 60);
    const leaveMinutes = user.leaveRequests.reduce((sum, request) => {
      return sum + (request.unit === "HOUR" ? Math.round(Number(request.hours ?? 0) * 60) : 8 * 60);
    }, 0);
    lines.push([user.name, user.department ?? "", String(days), minutesToHHMM(total), minutesToHHMM(overtime), minutesToHHMM(leaveMinutes)]);
  }

  const csv = lines.map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
  const bom = "\uFEFF";

  return new Response(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="monthly-attendance-${ym}.csv"`
    }
  });
}
