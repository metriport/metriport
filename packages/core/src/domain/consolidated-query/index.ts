import { ResourceTypeForConsolidation } from "./consolidation-resources";
import { ConsolidationConversionType } from "../conversion/fhir-to-medical-record";

export type GetConsolidatedFilters = {
  resources?: ResourceTypeForConsolidation[];
  dateFrom?: string;
  dateTo?: string;
  conversionType?: ConsolidationConversionType;
};
