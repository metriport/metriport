import { getSupportedResourcesByEhr } from "@metriport/core/external/ehr/bundle/bundle-shared";
import { isEhrSourceWithClientCredentials } from "@metriport/core/external/ehr/environment";
import { buildEhrRefreshEhrBundlesHandler } from "@metriport/core/external/ehr/job/create-resource-diff-bundles/steps/refresh/ehr-refresh-ehr-bundles-factory";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { completePatientJob } from "../../../../../../command/job/patient/complete";
import { updatePatientJobTotal } from "../../../../../../command/job/patient/update-total";
import { getTwoLeggedClientWithTokenIdAndEnvironment } from "../../../command/clients/get-two-legged-client";
import { RunCreateResourceDiffBundlesJobParams } from "../../../utils/job";

export async function runJob({
  jobId,
  ehr,
  cxId,
  practiceId,
  metriportPatientId,
  ehrPatientId,
}: RunCreateResourceDiffBundlesJobParams) {
  const resourceTypes = getSupportedResourcesByEhr(ehr);
  if (resourceTypes.length < 1) {
    await completePatientJob({ cxId, jobId });
    return jobId;
  }
  await updatePatientJobTotal({ cxId, jobId, total: resourceTypes.length });
  let tokenId: string | undefined;
  if (isEhrSourceWithClientCredentials(ehr)) {
    const clientWithTokenIdAndEnvironment = await getTwoLeggedClientWithTokenIdAndEnvironment({
      ehr,
      cxId,
      practiceId,
    });
    tokenId = clientWithTokenIdAndEnvironment.tokenId;
  }
  const ehrResourceDiffHandler = buildEhrRefreshEhrBundlesHandler();
  for (const resourceType of resourceTypes) {
    ehrResourceDiffHandler
      .refreshEhrBundles({
        ehr,
        ...(tokenId ? { tokenId } : {}),
        cxId,
        practiceId,
        metriportPatientId,
        ehrPatientId,
        resourceType,
        jobId,
      })
      .catch(processAsyncError(`${ehr} ${resourceType} refreshEhrBundles`));
  }
}
