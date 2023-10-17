import { Bundle, Resource } from "@medplum/fhirtypes";
import { ResourceTypeForConsolidation } from "@metriport/api-sdk";
import { ConsolidationConversionType } from "@metriport/api-sdk/medical/models/patient";

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
