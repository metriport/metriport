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

export const PAYMENT_CODES = [
  "01",
  "1",
  "02",
  "2",
  "03",
  "3",
  "04",
  "4",
  "05",
  "5",
  "06",
  "6",
  "07",
  "7",
  "99",
] as const;
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

export function getPaymentCodeName(code: PaymentCode): PaymentCodeName {
  if (code.length === 1 && code.match(/^[1-7]$/)) {
    return getPaymentCodeName(("0" + code) as PaymentCode);
  }
  return PAYMENT_CODE_NAME[code] ?? "Other";
}

export const PAYMENT_CODE_NAME: Partial<Record<PaymentCode, PaymentCodeName>> = {
  "01": "Private Pay",
  "02": "Medicaid",
  "03": "Medicare",
  "04": "Commercial Insurance",
  "05": "Military Installations and VA",
  "06": "Workers' Compensation",
  "07": "Indian Nations",
  "99": "Other",
};
