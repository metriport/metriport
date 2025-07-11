import { buildEhrContributeResourceDiffBundlesHandler } from "@metriport/core/external/ehr/job/bundle/contribute-bundles/ehr-contribute-resource-diff-bundles-factory";
import { processAsyncError } from "@metriport/core/util/error/shared";
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
  resourceType,
  createResourceDiffBundlesJobId,
}: RunBundlesJobParams & {
  resourceType: string;
  createResourceDiffBundlesJobId: string;
}): Promise<void> {
  await updatePatientJobTotal({ cxId, jobId, total: 1 });
  const tokenId = await getTokenIdFromClientWithClientCredentials({ ehr, cxId, practiceId });
  const ehrResourceDiffHandler = buildEhrContributeResourceDiffBundlesHandler();
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
