import { getSupportedResourcesByEhr } from "@metriport/core/external/ehr/bundle/bundle-shared";
import { buildEhrRefreshEhrBundlesHandler } from "@metriport/core/external/ehr/bundle/job/create-resource-diff-bundles/steps/refresh/ehr-refresh-ehr-bundles-factory";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { createPatientJob } from "../../../../../../command/job/patient/create";
import { updatePatientJobTotal } from "../../../../../../command/job/patient/update-total";
import { completeJob } from "../../../../../../command/job/complete";
import { getPatientMappingOrFail } from "../../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../../command/medical/patient/get-patient";
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
 * @param patientId - The patient id of the EHR patient.
 * @param requestId - The request id of the job. Optional, defaults to a new UUID.
 * @returns The job id of the resource diff bundles job.
 */
export async function startCreateResourceDiffBundlesJob({
  ehr,
  cxId,
  practiceId,
  patientId,
  requestId,
}: StartCreateResourceDiffBundlesJobParams): Promise<string> {
  const patientMapping = await getPatientMappingOrFail({
    cxId,
    externalId: patientId,
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
    jobGroupId: patientId,
    requestId,
    limitedToOneRunningJob: true,
  });
  const jobId = job.id;
  const resourceTypes = getSupportedResourcesByEhr(ehr);
  if (resourceTypes.length < 1) {
    await completeJob({ cxId, jobId });
    return jobId;
  }
  await updatePatientJobTotal({ cxId, jobId, total: resourceTypes.length });
  const ehrResourceDiffHandler = buildEhrRefreshEhrBundlesHandler();
  for (const resourceType of resourceTypes) {
    ehrResourceDiffHandler
      .refreshEhrBundles({
        ehr,
        cxId,
        practiceId,
        metriportPatientId,
        ehrPatientId: patientId,
        resourceType,
        jobId,
      })
      .catch(processAsyncError(`${ehr} ${resourceType} refreshEhrBundles`));
  }
  return jobId;
}
