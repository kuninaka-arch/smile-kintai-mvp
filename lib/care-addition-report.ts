import { WorkPatternCategory } from "@prisma/client";
import { minutesToHHMM } from "@/lib/attendance";
import { prisma } from "@/lib/prisma";

export const careAdditionStaffingCategories = [
  { category: WorkPatternCategory.EARLY, label: "早番" },
  { category: WorkPatternCategory.DAY, label: "日勤" },
  { category: WorkPatternCategory.LATE, label: "遅番" },
  { category: WorkPatternCategory.NIGHT, label: "夜勤" }
] as const;

const workCategorySet = new Set<WorkPatternCategory>(careAdditionStaffingCategories.map((item) => item.category));
const defaultStandardMinutes = 160 * 60;

export type AdditionStatus = "達成" | "注意" | "不足";

export type CareAdditionReportSummary = {
  ym: string;
  year: number;
  month: number;
  monthLabel: string;
  status: AdditionStatus;
  totalShortageDays: number;
  staffingShortageDays: number;
  qualificationShortageDays: number;
  nightShortageDays: number;
  totalFte: number;
  standardMonthlyMinutes: number;
  requiredNightCount: number;
  judgementComment: string;
  staffingShortages: { key: string; day: number; weekday: string; detail: string }[];
  qualificationShortages: { name: string; count: number }[];
  nightStaffCounts: { name: string; count: number }[];
  fteRows: { jobType: string; count: number; monthlyMinutes: number; fte: number }[];
};

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function tokyoMonthRange(year: number, month: number) {
  const start = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+09:00`);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = new Date(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+09:00`);
  return { start, end };
}

function dateKey(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function formatCareAdditionMonth(year: number, month: number) {
  return `${year}年${month}月`;
}

function timeToMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return 0;
  return hour * 60 + minute;
}

function plannedMinutes(shift: {
  startTime: string;
  endTime: string;
  breakMinutes: number;
  workPattern: { countsAsWork: boolean; isHoliday: boolean } | null;
}) {
  if (!shift.workPattern?.countsAsWork || shift.workPattern.isHoliday) return 0;
  if (shift.startTime === "00:00" && shift.endTime === "00:00") return 0;
  const start = timeToMinutes(shift.startTime);
  let end = timeToMinutes(shift.endTime);
  if (end <= start) end += 24 * 60;
  return Math.max(0, end - start - shift.breakMinutes);
}

export function assessCareAdditionStatus(shortageCount: number): AdditionStatus {
  if (shortageCount === 0) return "達成";
  if (shortageCount <= 3) return "注意";
  return "不足";
}

export function careAdditionJudgementComment(status: AdditionStatus) {
  if (status === "達成") return "設定された基準値に対する不足はありません。";
  if (status === "注意") return "一部に不足があります。詳細画面で不足日と不足区分を確認してください。";
  return "不足が複数あります。人員配置、資格者配置、夜勤体制の見直しを推奨します。";
}

export function buildCareAdditionMonthNav(ym: string, direction: -1 | 1) {
  const [year, month] = ym.split("-").map(Number);
  const date = new Date(year, month - 1 + direction, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function parseCareAdditionYm(ym: string | null | undefined) {
  const now = new Date();
  const value = ym ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [year, month] = value.split("-").map(Number);
  return {
    ym: value,
    year: Number.isFinite(year) ? year : now.getFullYear(),
    month: Number.isFinite(month) ? month : now.getMonth() + 1
  };
}

export async function buildCareAdditionReportSummary(companyId: string, ymValue?: string | null): Promise<CareAdditionReportSummary> {
  const { ym, year, month } = parseCareAdditionYm(ymValue);
  const { start, end } = tokyoMonthRange(year, month);
  const dayCount = daysInMonth(year, month);

  const [staffingRules, shifts, fteRule, usersForFte, qualifications] = await Promise.all([
    prisma.careStaffingRule.findMany({
      where: {
        companyId,
        category: { in: careAdditionStaffingCategories.map((item) => item.category) },
        floorId: null,
        departmentId: null
      }
    }),
    prisma.shift.findMany({
      where: { companyId, workDate: { gte: start, lt: end } },
      select: {
        workDate: true,
        user: {
          select: {
            id: true,
            name: true,
            qualifications: { select: { qualificationId: true } }
          }
        },
        workPattern: { select: { category: true } }
      }
    }),
    prisma.careFullTimeEquivalentRule.findFirst({
      where: { companyId },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        jobType: true,
        isFullTime: true,
        shifts: {
          where: { workDate: { gte: start, lt: end } },
          select: {
            startTime: true,
            endTime: true,
            breakMinutes: true,
            workPattern: { select: { countsAsWork: true, isHoliday: true } }
          }
        }
      },
      orderBy: [{ jobType: "asc" }, { displayOrder: "asc" }, { createdAt: "asc" }]
    }),
    prisma.qualificationMaster.findMany({
      where: { companyId },
      include: { careQualificationRules: true },
      orderBy: [{ name: "asc" }, { createdAt: "asc" }]
    })
  ]);

  const requiredByCategory = new Map<WorkPatternCategory, number>();
  for (const item of careAdditionStaffingCategories) {
    requiredByCategory.set(item.category, 0);
  }
  for (const rule of staffingRules) {
    requiredByCategory.set(rule.category, rule.requiredCount);
  }

  const assignedByDateAndCategory = new Map<string, Map<WorkPatternCategory, number>>();
  const nightShiftsByDate = new Map<string, typeof shifts>();
  const nightCountByUser = new Map<string, { name: string; count: number }>();
  const assignedByDateAndQualification = new Map<string, Map<string, Map<string, string>>>();

  for (const shift of shifts) {
    const category = shift.workPattern?.category;
    if (!category || !workCategorySet.has(category)) continue;

    const key = dateKey(shift.workDate);
    const perCategory = assignedByDateAndCategory.get(key) ?? new Map<WorkPatternCategory, number>();
    perCategory.set(category, (perCategory.get(category) ?? 0) + 1);
    assignedByDateAndCategory.set(key, perCategory);

    const perQualification = assignedByDateAndQualification.get(key) ?? new Map<string, Map<string, string>>();
    for (const qualification of shift.user.qualifications) {
      const staff = perQualification.get(qualification.qualificationId) ?? new Map<string, string>();
      staff.set(shift.user.id, shift.user.name);
      perQualification.set(qualification.qualificationId, staff);
    }
    assignedByDateAndQualification.set(key, perQualification);

    if (category === WorkPatternCategory.NIGHT) {
      nightShiftsByDate.set(key, [...(nightShiftsByDate.get(key) ?? []), shift]);
      const current = nightCountByUser.get(shift.user.id) ?? { name: shift.user.name, count: 0 };
      current.count += 1;
      nightCountByUser.set(shift.user.id, current);
    }
  }

  const dates = Array.from({ length: dayCount }, (_, index) => {
    const day = index + 1;
    const date = new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+09:00`);
    return {
      key: dateKey(date),
      day,
      weekday: new Intl.DateTimeFormat("ja-JP", { weekday: "short", timeZone: "Asia/Tokyo" }).format(date)
    };
  });

  const staffingShortages = dates
    .map((date) => {
      const shortages = careAdditionStaffingCategories
        .map((item) => {
          const required = requiredByCategory.get(item.category) ?? 0;
          const assigned = assignedByDateAndCategory.get(date.key)?.get(item.category) ?? 0;
          return {
            label: item.label,
            missing: Math.max(0, required - assigned)
          };
        })
        .filter((item) => item.missing > 0);

      return {
        ...date,
        detail: shortages.map((item) => `${item.label} ${item.missing}名不足`).join(" / "),
        shortageCount: shortages.length
      };
    })
    .filter((row) => row.shortageCount > 0)
    .map(({ shortageCount: _shortageCount, ...row }) => row);

  const qualificationRows = qualifications.map((qualification) => ({
    id: qualification.id,
    name: qualification.name,
    requiredCount: qualification.careQualificationRules[0]?.requiredCount ?? 0
  }));

  const qualificationShortageRows = dates
    .map((date) => {
      const perQualification = assignedByDateAndQualification.get(date.key) ?? new Map<string, Map<string, string>>();
      const shortages = qualificationRows
        .map((qualification) => {
          const assigned = perQualification.get(qualification.id)?.size ?? 0;
          return {
            name: qualification.name,
            missing: Math.max(0, qualification.requiredCount - assigned)
          };
        })
        .filter((item) => item.missing > 0);

      return { ...date, shortages };
    })
    .filter((row) => row.shortages.length > 0);

  const qualificationShortageCounts = new Map<string, number>();
  for (const row of qualificationShortageRows) {
    for (const shortage of row.shortages) {
      qualificationShortageCounts.set(shortage.name, (qualificationShortageCounts.get(shortage.name) ?? 0) + 1);
    }
  }
  const qualificationShortages = Array.from(qualificationShortageCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"));

  const requiredNightCount = requiredByCategory.get(WorkPatternCategory.NIGHT) ?? 0;
  const nightShortageDays = dates.filter((date) => {
    const assigned = nightShiftsByDate.get(date.key)?.length ?? 0;
    return assigned < requiredNightCount;
  }).length;

  const nightStaffCounts = Array.from(nightCountByUser.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"));

  const standardMonthlyMinutes = fteRule?.standardMonthlyMinutes ?? defaultStandardMinutes;
  const fteRowsByJobType = new Map<string, { jobType: string; count: number; monthlyMinutes: number }>();
  for (const user of usersForFte) {
    const jobType = user.jobType?.trim() || "未設定";
    const current = fteRowsByJobType.get(jobType) ?? { jobType, count: 0, monthlyMinutes: 0 };
    current.count += 1;
    current.monthlyMinutes += user.shifts.reduce((sum, shift) => sum + plannedMinutes(shift), 0);
    fteRowsByJobType.set(jobType, current);
  }

  const fteRows = Array.from(fteRowsByJobType.values())
    .map((row) => ({
      ...row,
      fte: standardMonthlyMinutes > 0 ? row.monthlyMinutes / standardMonthlyMinutes : 0
    }))
    .sort((a, b) => b.fte - a.fte || a.jobType.localeCompare(b.jobType, "ja"));
  const totalMinutes = fteRows.reduce((sum, row) => sum + row.monthlyMinutes, 0);
  const totalFte = standardMonthlyMinutes > 0 ? totalMinutes / standardMonthlyMinutes : 0;

  const staffingShortageDays = staffingShortages.length;
  const qualificationShortageDays = qualificationShortageRows.length;
  const totalShortageDays = staffingShortageDays + qualificationShortageDays + nightShortageDays;
  const status = assessCareAdditionStatus(totalShortageDays);

  return {
    ym,
    year,
    month,
    monthLabel: formatCareAdditionMonth(year, month),
    status,
    totalShortageDays,
    staffingShortageDays,
    qualificationShortageDays,
    nightShortageDays,
    totalFte,
    standardMonthlyMinutes,
    requiredNightCount,
    judgementComment: careAdditionJudgementComment(status),
    staffingShortages,
    qualificationShortages,
    nightStaffCounts,
    fteRows
  };
}

export function careAdditionSummaryRows(summary: CareAdditionReportSummary) {
  return [
    ["対象年月", summary.monthLabel],
    ["加算資料状況", summary.status],
    ["人員配置不足日数", `${summary.staffingShortageDays}日`],
    ["資格者配置不足日数", `${summary.qualificationShortageDays}日`],
    ["夜勤配置不足日数", `${summary.nightShortageDays}日`],
    ["常勤換算合計", summary.totalFte.toFixed(2)],
    ["基準月間時間", minutesToHHMM(summary.standardMonthlyMinutes)],
    ["判定コメント", summary.judgementComment]
  ];
}
