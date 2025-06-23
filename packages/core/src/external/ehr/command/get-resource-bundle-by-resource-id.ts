import { Bundle } from "@medplum/fhirtypes";
import { BadRequestError } from "@metriport/shared";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getResourceBundleByResourceId as getAthenaResourceBundleByResourceId } from "../athenahealth/command/get-resource-bundle-by-resource-id";
import { getResourceBundleByResourceId as getCanvasResourceBundleByResourceId } from "../canvas/command/get-resource-bundle-by-resource-id";
import { getResourceBundleByResourceId as getElationResourceBundleByResourceId } from "../elation/command/get-resource-bundle-by-resource-id";

export type GetResourceBundleByResourceIdRequest = {
  ehr: EhrSource;
  tokenId?: string;
  cxId: string;
  practiceId: string;
  metriportPatientId: string;
  ehrPatientId: string;
  resourceType: string;
  resourceId: string;
  useCachedBundle: boolean;
};

export type GetResourceBundleByResourceIdClientRequest = Omit<
  GetResourceBundleByResourceIdRequest,
  "ehr"
>;

export async function getResourceBundleByResourceId({
  ehr,
  ...params
}: GetResourceBundleByResourceIdRequest): Promise<Bundle> {
  const handler = getEhrGetResourceBundleByResourceIdHandler(ehr);
  return await handler({ ...params });
}

type GetResourceBundleByResourceId = (
  params: GetResourceBundleByResourceIdClientRequest
) => Promise<Bundle>;

type GetResourceBundleByResourceIdMethodsMap = Record<
  EhrSource,
  GetResourceBundleByResourceId | undefined
>;

const ehrGetResourceBundleByResourceIdMap: GetResourceBundleByResourceIdMethodsMap = {
  [EhrSources.canvas]: getCanvasResourceBundleByResourceId,
  [EhrSources.athena]: getAthenaResourceBundleByResourceId,
  [EhrSources.elation]: getElationResourceBundleByResourceId,
  [EhrSources.healthie]: undefined,
  [EhrSources.eclinicalworks]: undefined,
};

function getEhrGetResourceBundleByResourceIdHandler(ehr: EhrSource): GetResourceBundleByResourceId {
  const handler = ehrGetResourceBundleByResourceIdMap[ehr];
  if (!handler) {
    throw new BadRequestError(`No get resource bundle by resource id handler found`, undefined, {
      ehr,
    });
  }
  return handler;
}
