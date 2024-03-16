export const consolidationConversionType = ["html", "pdf"] as const;

export type ConsolidationConversionType = (typeof consolidationConversionType)[number];

export type Input = {
  fileName: string;
  patientId: string;
  firstName: string;
  cxId: string;
  dateFrom?: string;
  dateTo?: string;
  conversionType: ConsolidationConversionType;
};

export type Output = {
  url: string;
  hasContents?: boolean;
};
