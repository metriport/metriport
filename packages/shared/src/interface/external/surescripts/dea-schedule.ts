export function getDeaScheduleName(code: string): string | undefined {
  return DeaScheduleName[code as DEAScheduleCode];
}

export const DeaScheduleCodes = [
  "C38046",
  "C48672",
  "C48675",
  "C48676",
  "C48677",
  "C48679",
] as const;
export const DeaSchedules = [
  "Unspecified",
  "Schedule I",
  "Schedule II",
  "Schedule III",
  "Schedule IV",
  "Schedule V",
] as const;

export type DEAScheduleCode = (typeof DeaScheduleCodes)[number];
export type DEASchedule = (typeof DeaSchedules)[number];
export const DeaScheduleName: Record<DEAScheduleCode, DEASchedule> = {
  C38046: "Unspecified",
  C48672: "Schedule I",
  C48675: "Schedule II",
  C48676: "Schedule III",
  C48677: "Schedule IV",
  C48679: "Schedule V",
};
