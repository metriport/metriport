import { Bundle } from "@medplum/fhirtypes";
import { BadRequestError } from "@metriport/shared";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getBundleByResourceType as getBundleByResourceTypeAthena } from "../athenahealth/command/get-bundle-by-resource-type";
import { getBundleByResourceType as getBundleByResourceTypeCanvas } from "../canvas/command/get-bundle-by-resource-type";

export type GetBundleByResourceTypeRequest = {
  ehr: EhrSource;
  tokenId?: string;
  cxId: string;
  practiceId: string;
  metriportPatientId: string;
  ehrPatientId: string;
  resourceType: string;
  useCachedBundle: boolean;
};

export type GetBundleByResourceTypeClientRequest = Omit<GetBundleByResourceTypeRequest, "ehr">;

export async function getBundleByResourceType({
  ehr,
  ...params
}: GetBundleByResourceTypeRequest): Promise<Bundle> {
  const handler = getEhrGetBundleByResourceTypeHandler(ehr);
  return await handler({ ...params });
}

type GetBundleByResourceType = (params: GetBundleByResourceTypeClientRequest) => Promise<Bundle>;

type GetBundleByResourceTypeMethodsMap = Record<EhrSource, GetBundleByResourceType | undefined>;

const ehrGetBundleByResourceTypeMap: GetBundleByResourceTypeMethodsMap = {
  [EhrSources.canvas]: getBundleByResourceTypeCanvas,
  [EhrSources.athena]: getBundleByResourceTypeAthena,
  [EhrSources.elation]: undefined,
  [EhrSources.healthie]: undefined,
  [EhrSources.eclinicalworks]: undefined,
};

function getEhrGetBundleByResourceTypeHandler(ehr: EhrSource): GetBundleByResourceType {
  const handler = ehrGetBundleByResourceTypeMap[ehr];
  if (!handler) {
    throw new BadRequestError("No get bundle by resource type handler found", undefined, {
      ehr,
    });
  }
  return handler;
}
