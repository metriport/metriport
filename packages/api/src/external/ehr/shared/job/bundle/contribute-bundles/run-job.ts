import { getSupportedResourcesByEhr } from "@metriport/core/external/ehr/bundle/bundle-shared";
import { buildEhrContributeResourceDiffBundlesHandler } from "@metriport/core/external/ehr/job/bundle/contribute-bundles/ehr-contribute-resource-diff-bundles-factory";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { completePatientJob } from "../../../../../../command/job/patient/status/complete";
import { updatePatientJobTotal } from "../../../../../../command/job/patient/update/update-total";
import { getTokenIdFromClientWithClientCredentials } from "../../../command/clients/get-token-id-from-client";
import { RunBundlesJobParams } from "../../../utils/job";

export async function runJob({
  jobId,
  ehr,
  cxId,
  practiceId,
  metriportPatientId,
  ehrPatientId,
  createResourceDiffBundlesJobId,
}: RunBundlesJobParams & {
  createResourceDiffBundlesJobId: string;
}): Promise<void> {
  const resourceTypes = getSupportedResourcesByEhr(ehr);
  if (resourceTypes.length < 1) {
    await completePatientJob({ cxId, jobId });
    return;
  }
  await updatePatientJobTotal({ cxId, jobId, total: resourceTypes.length });
  const tokenId = await getTokenIdFromClientWithClientCredentials({ ehr, cxId, practiceId });
  const ehrResourceDiffHandler = buildEhrContributeResourceDiffBundlesHandler();
  for (const resourceType of resourceTypes) {
    ehrResourceDiffHandler
      .contributeResourceDiffBundles({
        ehr,
        ...(tokenId ? { tokenId } : {}),
        cxId,
        practiceId,
        metriportPatientId,
        ehrPatientId,
        resourceType,
        jobId,
        createResourceDiffBundlesJobId,
      })
      .catch(processAsyncError(`${ehr} ${resourceType} contributeResourceDiffBundles`));
  }
}
