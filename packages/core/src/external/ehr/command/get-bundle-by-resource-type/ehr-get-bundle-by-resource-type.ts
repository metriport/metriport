import { Bundle } from "@medplum/fhirtypes";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";

export type GetBundleByResourceTypeRequest = {
  ehr: EhrSource;
  environment: string;
  method: string;
  tokenId?: string;
  cxId: string;
  practiceId: string;
  metriportPatientId: string;
  ehrPatientId: string;
  resourceType: string;
  useCachedBundle: boolean;
};

export type GetBundleByResourceTypeClientRequest = Omit<
  GetBundleByResourceTypeRequest,
  "ehr" | "method"
>;

export interface EhrGetBundleByResourceTypeHandler {
  getBundleByResourceType(request: GetBundleByResourceTypeRequest): Promise<Bundle>;
}
