import { getSupportedResourcesByEhr } from "@metriport/core/external/ehr/bundle/bundle-shared";
import { isEhrSourceWithClientCredentials } from "@metriport/core/external/ehr/environment";
import { buildEhrContributeBundlesHandler } from "@metriport/core/external/ehr/job/bundle/contribute-bundles/ehr-contribute-bundles-factory";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { completePatientJob } from "../../../../../../command/job/patient/status/complete";
import { updatePatientJobTotal } from "../../../../../../command/job/patient/update/update-total";
import { getTwoLeggedClientWithTokenIdAndEnvironment } from "../../../command/clients/get-two-legged-client";
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
  let tokenId: string | undefined;
  if (isEhrSourceWithClientCredentials(ehr)) {
    const clientWithTokenIdAndEnvironment = await getTwoLeggedClientWithTokenIdAndEnvironment({
      ehr,
      cxId,
      practiceId,
    });
    tokenId = clientWithTokenIdAndEnvironment.tokenId;
  }
  const ehrResourceDiffHandler = buildEhrContributeBundlesHandler();
  for (const resourceType of resourceTypes) {
    ehrResourceDiffHandler
      .contributeBundles({
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
      .catch(processAsyncError(`${ehr} ${resourceType} contributeBundles`));
  }
}
