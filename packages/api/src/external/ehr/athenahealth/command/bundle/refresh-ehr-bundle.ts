import { GetBundleByResourceTypeMethods } from "@metriport/core/external/ehr/lambdas/get-bundle-by-resource-type/ehr-get-bundle-by-resource-type";
import { buildEhrGetBundleByResourceTypeHandler } from "@metriport/core/external/ehr/lambdas/get-bundle-by-resource-type/ehr-get-bundle-by-resource-type-factory";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { RefreshEhrBundleParamsForClient } from "../../../shared/utils/bundle/types";
import { createAthenaClientWithTokenIdAndEnvironment } from "../../shared";

export async function refreshEhrBundle({
  cxId,
  practiceId,
  ehrPatientId,
  metriportPatientId,
  resourceType,
}: RefreshEhrBundleParamsForClient): Promise<void> {
  const { tokenId, environment } = await createAthenaClientWithTokenIdAndEnvironment({
    cxId,
    practiceId,
  });
  const handler = buildEhrGetBundleByResourceTypeHandler();
  await handler.getBundleByResourceType({
    ehr: EhrSources.athena,
    environment,
    method: GetBundleByResourceTypeMethods.athenaGetBundleByResourceType,
    tokenId,
    cxId,
    practiceId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
    useCachedBundle: false,
  });
}
