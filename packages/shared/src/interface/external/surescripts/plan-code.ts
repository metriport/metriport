export function getPlanCodeName(planCode: string): PlanCodeName {
  return PlanCodeName[planCode as PlanCode];
}

export const PlanCodes = ["01", "02", "03", "04", "05", "06"] as const;
export const PlanCodeNames = [
  "PrivatePay",
  "Medicaid",
  "Medicare",
  "Commercial PBM Insurance",
  "Major Medical",
  "Workers' Compensation",
] as const;

export type PlanCode = (typeof PlanCodes)[number];
export type PlanCodeName = (typeof PlanCodeNames)[number];

export const PlanCodeName: Record<PlanCode, PlanCodeName> = {
  "01": "PrivatePay",
  "02": "Medicaid",
  "03": "Medicare",
  "04": "Commercial PBM Insurance",
  "05": "Major Medical",
  "06": "Workers' Compensation",
};
