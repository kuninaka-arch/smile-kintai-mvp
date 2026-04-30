import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { calcDailyWorkMinutes, minutesToHHMM } from "@/lib/attendance";

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
      }
    }
  });

  const lines = [["氏名", "所属", "出勤日数", "総労働時間", "残業時間"]];

  for (const user of users) {
    const byDate = new Map<string, typeof user.attendanceLogs>();
    for (const log of user.attendanceLogs) {
      const key = log.stampedAt.toISOString().slice(0, 10);
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
    lines.push([user.name, user.department ?? "", String(days), minutesToHHMM(total), minutesToHHMM(overtime)]);
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
