import { ConsolidationConversionType } from "@metriport/api-sdk";
import { ConsolidatedFhirToBundlePayload } from "../../external/fhir/consolidated/consolidated";

export type ConsolidatedPatientDataRequest = ConsolidatedFhirToBundlePayload & {
  generateAiBrief?: boolean;
};

export type ConsolidatedDataRequestAsync = ConsolidatedPatientDataRequest & {
  isAsync: true;
  requestId: string;
  conversionType?: ConsolidationConversionType | undefined;
  fromDashboard?: boolean | undefined;
};

export type ConsolidatedDataRequestSync = ConsolidatedPatientDataRequest & {
  isAsync: false;
  requestId?: string | undefined;
  fromDashboard?: boolean | undefined;
};

export type ConsolidatedDataResponse = {
  bundleLocation: string;
  bundleFilename: string;
};

export interface ConsolidatedDataConnector {
  execute(
    params: ConsolidatedDataRequestSync | ConsolidatedDataRequestAsync
  ): Promise<ConsolidatedDataResponse>;
}