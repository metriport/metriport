import { ConsolidationConversionType } from "@metriport/api-sdk";
import { ConsolidatedFhirToBundlePayload } from "../external/fhir/consolidated";

export type ConsolidatedFhirToBundlePayloadLambda = ConsolidatedFhirToBundlePayload & {
  requestId?: string;
  conversionType?: ConsolidationConversionType;
  isAsync: boolean;
};
