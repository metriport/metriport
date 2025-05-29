import { buildEhrGetBundleByResourceTypeHandler } from "@metriport/core/external/ehr/command/get-bundle-by-resource-type/ehr-get-bundle-by-resource-type-factory";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { RefreshEhrBundleParamsForClient } from "../../../shared/utils/bundle/types";
import { createCanvasClientWithTokenIdAndEnvironment } from "../../shared";

export async function refreshEhrBundle({
  cxId,
  practiceId,
  ehrPatientId,
  metriportPatientId,
  resourceType,
}: RefreshEhrBundleParamsForClient): Promise<void> {
  const { tokenId, environment } = await createCanvasClientWithTokenIdAndEnvironment({
    cxId,
    practiceId,
  });
  const handler = buildEhrGetBundleByResourceTypeHandler();
  await handler.getBundleByResourceType({
    ehr: EhrSources.canvas,
    environment,
    tokenId,
    cxId,
    practiceId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
    useCachedBundle: false,
  });
}
