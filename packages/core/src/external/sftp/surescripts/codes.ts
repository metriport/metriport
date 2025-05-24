export const PREFIXES = [
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "rev",
  "st",
  "hon",
  "honorable",
  "honorable mr",
  "honorable mrs",
  "honorable ms",
  "honorable dr",
  "honorable prof",
  "honorable rev",
  "honorable st",
] as const;
export const SUFFIXES = [
  "jr",
  "sr",
  "ii",
  "iii",
  "iv",
  "v",
  "vi",
  "vii",
  "viii",
  "ix",
  "x",
  "2nd",
  "3rd",
  "4th",
  "5th",
  "6th",
  "7th",
  "8th",
  "9th",
  "10th",
] as const;
export type Prefix = (typeof PREFIXES)[number];
export type Suffix = (typeof SUFFIXES)[number];

export const PREFIX_SET = new Set(PREFIXES);
export const SUFFIX_SET = new Set(SUFFIXES);

export function isPrefix(prefix: string): prefix is Prefix {
  return PREFIX_SET.has(prefix as Prefix);
}
export function isSuffix(suffix: string): suffix is Suffix {
  return SUFFIX_SET.has(suffix as Suffix);
}

export const DEA_SCHEDULE_CODES = [
  "C38046",
  "C48672",
  "C48675",
  "C48676",
  "C48677",
  "C48679",
] as const;
export const DEA_SCHEDULES = [
  "Unspecified",
  "Schedule I",
  "Schedule II",
  "Schedule III",
  "Schedule IV",
  "Schedule V",
] as const;
export type DEAScheduleCode = (typeof DEA_SCHEDULE_CODES)[number];
export type DEASchedule = (typeof DEA_SCHEDULES)[number];
export const DEA_SCHEDULE_NAME: Record<DEAScheduleCode, DEASchedule> = {
  C38046: "Unspecified",
  C48672: "Schedule I",
  C48675: "Schedule II",
  C48676: "Schedule III",
  C48677: "Schedule IV",
  C48679: "Schedule V",
};

export const CODE_LIST_QUALIFIERS = ["38", "40", "87", "QS"] as const;
export const CODE_LIST_QUALIFIER_NAMES = [
  "Original Quantity",
  "Remaining Quantity",
  "Quantity Received",
  "Quantity Sufficient",
] as const;
export type CodeListQualifier = (typeof CODE_LIST_QUALIFIERS)[number];
export type CodeListQualifierName = (typeof CODE_LIST_QUALIFIER_NAMES)[number];

export const CodeListQualifierName: Record<CodeListQualifier, CodeListQualifierName> = {
  "38": "Original Quantity",
  "40": "Remaining Quantity",
  "87": "Quantity Received",
  QS: "Quantity Sufficient",
};

export const PLAN_CODES = ["01", "02", "03", "04", "05", "06"] as const;
export const PLAN_CODE_NAMES = [
  "PrivatePay",
  "Medicaid",
  "Medicare",
  "Commercial PBM Insurance",
  "Major Medical",
  "Workers' Compensation",
] as const;

export type PlanCode = (typeof PLAN_CODES)[number];
export type PlanCodeName = (typeof PLAN_CODE_NAMES)[number];

export const PLAN_CODE_NAME: Record<PlanCode, PlanCodeName> = {
  "01": "PrivatePay",
  "02": "Medicaid",
  "03": "Medicare",
  "04": "Commercial PBM Insurance",
  "05": "Major Medical",
  "06": "Workers' Compensation",
};

export const PAYMENT_CODES = ["01", "02", "03", "04", "05", "06", "07", "99"] as const;
export const PAYMENT_CODE_NAMES = [
  "Private Pay",
  "Medicaid",
  "Medicare",
  "Commercial Insurance",
  "Military Installations and VA",
  "Workers' Compensation",
  "Indian Nations",
  "Other",
] as const;
export type PaymentCode = (typeof PAYMENT_CODES)[number];
export type PaymentCodeName = (typeof PAYMENT_CODE_NAMES)[number];

export const PAYMENT_CODE_NAME: Record<PaymentCode, PaymentCodeName> = {
  "01": "Private Pay",
  "02": "Medicaid",
  "03": "Medicare",
  "04": "Commercial Insurance",
  "05": "Military Installations and VA",
  "06": "Workers' Compensation",
  "07": "Indian Nations",
  "99": "Other",
};
