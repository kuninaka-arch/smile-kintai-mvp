import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const ym = String(body.ym ?? "");
  const csv = String(body.csv ?? "").replace(/^\uFEFF/, "");
  const [year, month] = ym.split("-").map(Number);
  if (!year || !month || !csv) {
    return NextResponse.json({ error: "取込データが不正です。" }, { status: 400 });
  }

  const dayCount = new Date(year, month, 0).getDate();
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const rows = parseCsv(csv);
  const headerRow = rows.find((row) => row.some((cell) => cell.trim() === "1")) ?? rows[0] ?? [];
  const dayColumns = Array.from({ length: dayCount }, (_, i) => {
    const day = String(i + 1);
    const index = headerRow.findIndex((cell) => cell.trim() === day);
    return index >= 0 ? index : i + 4;
  });
  const nameIndex = headerRow.findIndex((cell) => cell.trim() === "氏名");
  const resolvedNameIndex = nameIndex >= 0 ? nameIndex : 2;
  const eventRow = rows.find((row) => row[0]?.trim() === "行事");
  const dataRows = rows.filter((row) => {
    const first = row[0]?.trim();
    return first && !["番号", "行事", "日回数"].includes(first);
  });

  const [users, patterns] = await Promise.all([
    prisma.user.findMany({ where: { companyId: session.user.companyId } }),
    prisma.workPattern.findMany({ where: { companyId: session.user.companyId, isActive: true } })
  ]);

  const userByName = new Map(users.map((user) => [user.name, user]));
  const patternByCode = new Map(patterns.map((pattern) => [pattern.code, pattern]));
  const shifts: Array<{
    companyId: string;
    userId: string;
    workDate: Date;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    patternCode: string;
    workPatternId: string;
  }> = [];

  for (const row of dataRows) {
    const userName = row[resolvedNameIndex]?.trim();
    const user = userName ? userByName.get(userName) : null;
    if (!user) continue;

    for (let day = 1; day <= dayCount; day += 1) {
      const code = row[dayColumns[day - 1]]?.trim();
      if (!code) continue;

      const pattern = patternByCode.get(code);
      if (!pattern) continue;

      shifts.push({
        companyId: session.user.companyId,
        userId: user.id,
        workDate: new Date(`${ym}-${String(day).padStart(2, "0")}T00:00:00`),
        startTime: pattern.startTime,
        endTime: pattern.endTime,
        breakMinutes: pattern.breakMinutes,
        patternCode: pattern.code,
        workPatternId: pattern.id
      });
    }
  }

  const events = Array.from({ length: dayCount }, (_, i) => {
    const title = eventRow?.[dayColumns[i]]?.trim() ?? "";
    return {
      companyId: session.user.companyId,
      workDate: new Date(`${ym}-${String(i + 1).padStart(2, "0")}T00:00:00`),
      title
    };
  }).filter((event) => event.title);

  await prisma.$transaction([
    prisma.shift.deleteMany({
      where: { companyId: session.user.companyId, workDate: { gte: start, lt: end } }
    }),
    prisma.shiftEvent.deleteMany({
      where: { companyId: session.user.companyId, workDate: { gte: start, lt: end } }
    }),
    ...(shifts.length ? [prisma.shift.createMany({ data: shifts })] : []),
    ...(events.length ? [prisma.shiftEvent.createMany({ data: events })] : [])
  ]);

  return NextResponse.json({ ok: true, count: shifts.length, eventCount: events.length });
}
