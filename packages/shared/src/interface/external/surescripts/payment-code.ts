export function getPaymentCodeName(paymentCode: string): PaymentCodeName | undefined {
  return PaymentCodeName[paymentCode as PaymentCode];
}

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

export function getSourceOfPaymentCode(paymentCode: string): SourceOfPaymentCode | undefined {
  return PaymentCodeToSourceOfPaymentCode[paymentCode as PaymentCode];
}

export function getSourceOfPaymentName(sourceOfPaymentCode: string): string | undefined {
  return SourceOfPaymentName[sourceOfPaymentCode as SourceOfPaymentCode];
}

// https://www.nahdo.org/sopt
const SourceOfPaymentCodes = [
  "1",
  "2",
  "3",
  "312",
  "33",
  "4",
  "5",
  "6",
  "7",
  "8",
  "89",
  "95",
  "99",
] as const;
export type SourceOfPaymentCode = (typeof SourceOfPaymentCodes)[number];

export const SourceOfPaymentName: Record<SourceOfPaymentCode, string> = {
  "1": "Medicare",
  "2": "Medicaid",
  "3": "Government",
  "312": "Military Treatment Facility",
  "33": "Indian Health Service",
  "4": "Department of Corrections",
  "5": "Private Health Insurance",
  "6": "Blue Cross/Blue Shield",
  "7": "Managed Care",
  "8": "Private Pay",
  "89": "No Payment",
  "95": "Worker's Compensation",
  "99": "No code available",
};

export const PaymentCodeToSourceOfPaymentCode: Record<PaymentCode, SourceOfPaymentCode> = {
  "01": "5", // private pay
  "02": "2", // medicaid
  "03": "1", // medicare
  "04": "5", // commercial insurance
  "05": "312", // military
  "06": "95", // workers' compensation
  "07": "33", // indian nations
  "99": "99", // other
};
