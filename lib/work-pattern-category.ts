export const workPatternCategories = [
  { value: "EARLY", label: "早番" },
  { value: "DAY", label: "日勤" },
  { value: "LATE", label: "遅番" },
  { value: "NIGHT", label: "夜勤" },
  { value: "AFTER_NIGHT", label: "明け" },
  { value: "OFF", label: "休み" },
  { value: "PAID_LEAVE", label: "有給" },
  { value: "REQUESTED_OFF", label: "希望休" }
] as const;

export type WorkPatternCategoryValue = (typeof workPatternCategories)[number]["value"];

export function normalizeWorkPatternCategory(value: unknown): WorkPatternCategoryValue {
  return workPatternCategories.some((category) => category.value === value) ? (value as WorkPatternCategoryValue) : "DAY";
}

export function workPatternCategoryLabel(value: string | null | undefined) {
  return workPatternCategories.find((category) => category.value === value)?.label ?? "日勤";
}

export function defaultWorkPatternFlags(category: WorkPatternCategoryValue) {
  if (category === "NIGHT") {
    return {
      isNightShift: true,
      autoCreateAfterNight: true,
      countsAsWork: true,
      countsAsLeave: false,
      isHoliday: false
    };
  }

  if (category === "PAID_LEAVE") {
    return {
      isNightShift: false,
      autoCreateAfterNight: false,
      countsAsWork: false,
      countsAsLeave: true,
      isHoliday: true
    };
  }

  if (["AFTER_NIGHT", "OFF", "REQUESTED_OFF"].includes(category)) {
    return {
      isNightShift: false,
      autoCreateAfterNight: false,
      countsAsWork: false,
      countsAsLeave: false,
      isHoliday: true
    };
  }

  return {
    isNightShift: false,
    autoCreateAfterNight: false,
    countsAsWork: true,
    countsAsLeave: false,
    isHoliday: false
  };
}
