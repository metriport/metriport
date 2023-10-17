import { z } from "zod";
import { Bundle, Resource } from "@medplum/fhirtypes";
import { ResourceTypeForConsolidation } from "@metriport/api-sdk";

export type FhirToMedicalRecordPayload = {
  bundle: Bundle<Resource>;
  patientId: string;
  firstName: string;
  cxId: string;
  resources?: ResourceTypeForConsolidation[];
  dateFrom?: string;
  dateTo?: string;
  conversionType: ConsolidationConversionType;
};

export const consolidationConversionTypeSchema = z.enum(["html", "pdf", "xml"]);

export type ConsolidationConversionType = z.infer<typeof consolidationConversionTypeSchema>;
