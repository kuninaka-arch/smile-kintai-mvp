import type { IndustryType } from "@prisma/client";

export type IndustryTypeValue = IndustryType | string | null | undefined;

export function normalizeIndustryType(industryType: IndustryTypeValue) {
  return industryType ?? "general";
}

export function isCareCompany(industryType: IndustryTypeValue) {
  return normalizeIndustryType(industryType) === "care";
}

export function isRestaurantCompany(industryType: IndustryTypeValue) {
  return normalizeIndustryType(industryType) === "restaurant";
}

export function isCleaningCompany(industryType: IndustryTypeValue) {
  return normalizeIndustryType(industryType) === "cleaning";
}

export function isConstructionCompany(industryType: IndustryTypeValue) {
  return normalizeIndustryType(industryType) === "construction";
}
