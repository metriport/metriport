import { ConsolidationConversionType } from "@metriport/api-sdk";
import { ResourceTypeForConsolidation } from "@metriport/shared/medical";
import { Organization } from "../../domain/organization";
import { Patient } from "../../domain/patient";

export type ConsolidatedSnapshotRequest = {
  patient: Patient;
  organization: Organization;
  requestId?: string;
  resources?: ResourceTypeForConsolidation[] | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
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
