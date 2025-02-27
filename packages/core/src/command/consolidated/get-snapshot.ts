import { ConsolidationConversionType } from "@metriport/api-sdk";
import { ResourceTypeForConsolidation } from "@metriport/shared/medical";
import { Patient } from "../../domain/patient";

export type ConsolidatedSnapshotRequest = {
  patient: Patient;
  requestId?: string;
  resources?: ResourceTypeForConsolidation[] | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  generateAiBrief?: boolean;
  postHogApiKey?: string;
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
  // TODO 2215 Remove this when we have contributed data as part of get consolidated (from S3)
  forceDataFromFhir?: boolean | undefined;
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
