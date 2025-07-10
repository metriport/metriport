import { Bundle } from "@medplum/fhirtypes";
import { BadRequestError } from "@metriport/shared";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getBundleByResourceType as getBundleByResourceTypeAthena } from "../athenahealth/command/get-bundle-by-resource-type";
import { getBundleByResourceType as getBundleByResourceTypeCanvas } from "../canvas/command/get-bundle-by-resource-type";
import { getBundleByResourceType as getBundleByResourceTypeElation } from "../elation/command/get-bundle-by-resource-type";
import { getBundleByResourceType as getBundleByResourceTypeHealthie } from "../healthie/command/get-bundle-by-resource-type";

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

type GetBundleByResourceTypeFn = (params: GetBundleByResourceTypeClientRequest) => Promise<Bundle>;

type GetBundleByResourceTypeFnMap = Record<EhrSource, GetBundleByResourceTypeFn | undefined>;

const ehrGetBundleByResourceTypeMap: GetBundleByResourceTypeFnMap = {
  [EhrSources.canvas]: getBundleByResourceTypeCanvas,
  [EhrSources.athena]: getBundleByResourceTypeAthena,
  [EhrSources.elation]: getBundleByResourceTypeElation,
  [EhrSources.healthie]: getBundleByResourceTypeHealthie,
  [EhrSources.eclinicalworks]: undefined,
};

function getEhrGetBundleByResourceTypeHandler(ehr: EhrSource): GetBundleByResourceTypeFn {
  const handler = ehrGetBundleByResourceTypeMap[ehr];
  if (!handler) {
    throw new BadRequestError("Could not find handler to get bundle by resource type", undefined, {
      ehr,
    });
  }
  return handler;
}
