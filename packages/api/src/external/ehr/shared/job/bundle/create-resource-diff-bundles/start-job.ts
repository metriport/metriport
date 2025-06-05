import { getSupportedResourcesByEhr } from "@metriport/core/external/ehr/bundle/bundle-shared";
import { isEhrSourceWithClientCredentials } from "@metriport/core/external/ehr/environment";
import { buildEhrRefreshEhrBundlesHandler } from "@metriport/core/external/ehr/job/create-resource-diff-bundles/steps/refresh/ehr-refresh-ehr-bundles-factory";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { completePatientJob } from "../../../../../../command/job/patient/complete";
import { createPatientJob } from "../../../../../../command/job/patient/create";
import { initializePatientJob } from "../../../../../../command/job/patient/initialize";
import { updatePatientJobTotal } from "../../../../../../command/job/patient/update-total";
import { getPatientMappingOrFail } from "../../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../../command/medical/patient/get-patient";
import { getTwoLeggedClientWithTokenIdAndEnvironment } from "../../../command/clients/get-two-legged-client";
import {
  StartCreateResourceDiffBundlesJobParams,
  getCreateResourceDiffBundlesJobType,
} from "../../../utils/job";

/**
 * Starts the resource diff job to produce the resource type bundles containing
 * the resources in Metriport that are not in the EHR and vice versa.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID of the patient.
 * @param practiceId - The practice id of the EHR patient.
 * @param ehrPatientId - The patient id of the EHR patient.
 * @param requestId - The request id of the job. Optional, defaults to a new UUID.
 * @returns The job id of the resource diff bundles job.
 */
export async function startCreateResourceDiffBundlesJob({
  ehr,
  cxId,
  practiceId,
  ehrPatientId,
  requestId,
}: StartCreateResourceDiffBundlesJobParams): Promise<string> {
  const patientMapping = await getPatientMappingOrFail({
    cxId,
    externalId: ehrPatientId,
    source: ehr,
  });
  const metriportPatient = await getPatientOrFail({
    cxId,
    id: patientMapping.patientId,
  });
  const metriportPatientId = metriportPatient.id;
  const job = await createPatientJob({
    cxId,
    patientId: metriportPatientId,
    jobType: getCreateResourceDiffBundlesJobType(ehr),
    jobGroupId: ehrPatientId,
    requestId,
    limitedToOneRunningJob: true,
  });
  const jobId = job.id;
  await initializePatientJob({ cxId, jobId });
  const resourceTypes = getSupportedResourcesByEhr(ehr);
  if (resourceTypes.length < 1) {
    await completePatientJob({ cxId, jobId });
    return jobId;
  }
  await updatePatientJobTotal({ cxId, jobId, total: resourceTypes.length });
  const ehrResourceDiffHandler = buildEhrRefreshEhrBundlesHandler();
  let tokenId: string | undefined;
  if (isEhrSourceWithClientCredentials(ehr)) {
    const clientWithTokenIdAndEnvironment = await getTwoLeggedClientWithTokenIdAndEnvironment({
      ehr,
      cxId,
      practiceId,
    });
    tokenId = clientWithTokenIdAndEnvironment.tokenId;
  }
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
  return jobId;
}
