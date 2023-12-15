import { BaseResultDomain, BaseResponse } from "./ihe-result";

export interface PatientDiscoveryResult extends BaseResultDomain {
  data: PatientDiscoveryResponse;
}

export type PatientDiscoveryResponse = BaseResponse & {
  patientMatch: boolean;
  xcpdHomeCommunityId?: string;
  gateway: { oid: string; url: string };
};
