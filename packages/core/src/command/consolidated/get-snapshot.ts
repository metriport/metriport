import { ConsolidationConversionType } from "@metriport/api-sdk";
import { ConsolidatedFhirToBundlePayload } from "../../external/fhir/consolidated/consolidated";

export type ConsolidatedSnapshotRequest = ConsolidatedFhirToBundlePayload & {
  generateAiBrief?: boolean;
};

export type ConsolidatedSnapshotRequestAsync = ConsolidatedSnapshotRequest & {
  isAsync: true;
  requestId: string;
  conversionType?: ConsolidationConversionType | undefined;
  fromDashboard?: boolean | undefined;
};

export type ConsolidatedSnapshotRequestSync = ConsolidatedSnapshotRequest & {
  isAsync: false;
  requestId?: string | undefined;
  fromDashboard?: boolean | undefined;
};

export type ConsolidatedSnapshotResponse = {
  bundleLocation: string;
  bundleFilename: string;
};

export interface ConsolidatedSnapshotConnector {
  execute(
    params: ConsolidatedSnapshotRequestSync | ConsolidatedSnapshotRequestAsync
  ): Promise<ConsolidatedSnapshotResponse>;
}
