export const consolidationConversionType = ["html", "pdf", "json"] as const;
export type ConsolidationConversionType = (typeof consolidationConversionType)[number];

export const mrDocType = ["html", "pdf"] as const;
export type MedicalRecordDocType = (typeof mrDocType)[number];

export type Input = {
  fileName: string;
  patientId: string;
  firstName: string;
  cxId: string;
  dateFrom?: string;
  dateTo?: string;
  conversionType: MedicalRecordDocType;
};

export type Output = {
  url: string;
  hasContents?: boolean;
};
