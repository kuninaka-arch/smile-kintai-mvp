import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { logAction } from "@/lib/audit-log";

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const url = new URL(req.url);
  const now = new Date();
  const ym = url.searchParams.get("ym") ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [year, month] = ym.split("-").map(Number);
  const dayCount = daysInMonth(year, month);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const [users, shifts, patterns, events] = await Promise.all([
    prisma.user.findMany({
      where: { companyId: session.user.companyId },
      orderBy: [{ department: "asc" }, { createdAt: "asc" }]
    }),
    prisma.shift.findMany({
      where: { companyId: session.user.companyId, workDate: { gte: start, lt: end } }
    }),
    prisma.workPattern.findMany({
      where: { companyId: session.user.companyId }
    }),
    prisma.shiftEvent.findMany({
      where: { companyId: session.user.companyId, workDate: { gte: start, lt: end } }
    }).catch(() => [])
  ]);

  const shiftMap = new Map(shifts.map((shift) => [`${shift.userId}_${dateKey(shift.workDate)}`, shift]));
  const patternMap = new Map(patterns.map((pattern) => [pattern.id, pattern]));
  const eventMap = new Map(events.map((event) => [dateKey(event.workDate), event.title]));
  const days = Array.from({ length: dayCount }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`);

  const lines: string[][] = [];
  lines.push(["番号", "氏名", "所属", ...days.map((date) => date.slice(8)), "月回数"]);
  lines.push(["行事", "", "", ...days.map((date) => eventMap.get(date) ?? ""), ""]);

  users.forEach((user, index) => {
    let monthlyCount = 0;
    const codes = days.map((date) => {
      const shift = shiftMap.get(`${user.id}_${date}`);
      const pattern = shift?.workPatternId ? patternMap.get(shift.workPatternId) : null;
      if (shift && !pattern?.isHoliday) monthlyCount += 1;
      return shift?.patternCode ?? pattern?.code ?? "";
    });

    lines.push([String(index + 1).padStart(3, "0"), user.name, user.department ?? "", ...codes, String(monthlyCount)]);
  });

  const dailyCounts = days.map((date) => {
    return String(
      users.filter((user) => {
        const shift = shiftMap.get(`${user.id}_${date}`);
        const pattern = shift?.workPatternId ? patternMap.get(shift.workPatternId) : null;
        return Boolean(shift && !pattern?.isHoliday);
      }).length
    );
  });
  lines.push(["日回数", "", "", ...dailyCounts, String(dailyCounts.reduce((sum, count) => sum + Number(count), 0))]);

  const csv = "\uFEFF" + lines.map((line) => line.map(csvEscape).join(",")).join("\n");

  await logAction({
    request: req,
    userId: session.user.id,
    companyId: session.user.companyId,
    action: "EXPORT_SHIFT_CSV",
    targetType: "REPORT",
    targetId: ym,
    after: { fileType: "CSV", reportType: "SHIFT" },
    meta: {
      ym,
      userCount: users.length,
      shiftCount: shifts.length,
      eventCount: events.length,
      rowCount: lines.length
    }
  });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="shift-${ym}.csv"`
    }
  });
}
