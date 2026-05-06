import { AttendanceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatJaTime, typeLabel } from "@/lib/attendance";
import { apiError, requireCompanyUser, requireUnlockedDate } from "@/lib/authz";

const validTypes: AttendanceType[] = ["CLOCK_IN", "CLOCK_OUT", "BREAK_START", "BREAK_END"];

function todayRange() {
  const key = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  const start = new Date(`${key}T00:00:00+09:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function validateNextPunch(type: AttendanceType, logs: { type: AttendanceType }[]) {
  const last = logs.at(-1)?.type ?? null;

  if (type === "CLOCK_IN") {
    if (last && last !== "CLOCK_OUT") return "すでに出勤済みです。";
    if (last === "CLOCK_OUT") return "本日は退勤済みのため、再度出勤できません。";
    return null;
  }

  if (type === "CLOCK_OUT") {
    if (!last) return "出勤前に退勤はできません。";
    if (last === "CLOCK_OUT") return "すでに退勤済みです。";
    if (last === "BREAK_START") return "休憩中です。休憩終了を押してから退勤してください。";
    return null;
  }

  if (type === "BREAK_START") {
    if (!last) return "出勤前に休憩開始はできません。";
    if (last === "BREAK_START") return "すでに休憩中です。";
    if (last === "CLOCK_OUT") return "退勤後に休憩開始はできません。";
    return null;
  }

  if (type === "BREAK_END") {
    if (last !== "BREAK_START") return "休憩中ではないため、休憩終了はできません。";
    return null;
  }

  return "打刻種別が正しくありません。";
}

export async function POST(req: Request) {
  const auth = await requireCompanyUser();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));
  const type = body.type as AttendanceType;

  if (!validTypes.includes(type)) {
    return apiError("打刻種別が正しくありません。", 400);
  }

  const lockError = await requireUnlockedDate(session.user.companyId, new Date(), "打刻");
  if (lockError) return lockError;

  const { start, end } = todayRange();
  const todaysLogs = await prisma.attendanceLog.findMany({
    where: {
      companyId: session.user.companyId,
      userId: session.user.id,
      stampedAt: { gte: start, lt: end }
    },
    orderBy: { stampedAt: "asc" },
    select: { type: true }
  });

  const stateError = validateNextPunch(type, todaysLogs);
  if (stateError) return apiError(stateError, 409);

  const log = await prisma.attendanceLog.create({
    data: {
      companyId: session.user.companyId,
      userId: session.user.id,
      type,
      latitude: typeof body.latitude === "number" ? body.latitude : null,
      longitude: typeof body.longitude === "number" ? body.longitude : null
    }
  });

  return Response.json({
    ok: true,
    label: typeLabel(type),
    time: formatJaTime(log.stampedAt)
  });
}
