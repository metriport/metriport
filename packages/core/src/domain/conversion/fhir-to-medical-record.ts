export const consolidationConversionType = ["html", "pdf", "json"] as const;
export type ConsolidationConversionType = (typeof consolidationConversionType)[number];

export const mrFormat = ["html", "pdf"] as const;
export type MedicalRecordFormat = (typeof mrFormat)[number];

export type Input = {
  fileName: string;
  patientId: string;
  firstName: string;
  cxId: string;
  dateFrom?: string;
  dateTo?: string;
  conversionType: MedicalRecordFormat;
};

export type Output = {
  url: string;
  hasContents?: boolean;
};
