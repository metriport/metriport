export const PaymentCodes = ["01", "02", "03", "04", "05", "06", "07", "99"] as const;
export const PaymentCodeNames = [
  "Private Pay",
  "Medicaid",
  "Medicare",
  "Commercial Insurance",
  "Military Installations and VA",
  "Workers' Compensation",
  "Indian Nations",
  "Other",
] as const;
export type PaymentCode = (typeof PaymentCodes)[number];
export type PaymentCodeName = (typeof PaymentCodeNames)[number];

export const PaymentCodeName: Record<PaymentCode, PaymentCodeName> = {
  "01": "Private Pay",
  "02": "Medicaid",
  "03": "Medicare",
  "04": "Commercial Insurance",
  "05": "Military Installations and VA",
  "06": "Workers' Compensation",
  "07": "Indian Nations",
  "99": "Other",
};
