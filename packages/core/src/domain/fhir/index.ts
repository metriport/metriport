export type FhirToMedicalRecordPayload = {
  fileName: string;
  patientId: string;
  firstName: string;
  cxId: string;
  dateFrom?: string;
  dateTo?: string;
  conversionType: ConsolidationConversionType;
};

export const consolidationConversionType = ["html", "pdf", "xml"] as const;

export type ConsolidationConversionType = (typeof consolidationConversionType)[number];
