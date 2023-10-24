export const consolidationConversionType = ["html", "pdf", "xml"] as const;

export type ConsolidationConversionType = (typeof consolidationConversionType)[number];

export type Input = {
  fileName: string;
  patientId: string;
  firstName: string;
  lastName: string;
  dob: string;
  cxId: string;
  dateFrom?: string;
  dateTo?: string;
  conversionType: ConsolidationConversionType;
};

export type Output = { url: string };
