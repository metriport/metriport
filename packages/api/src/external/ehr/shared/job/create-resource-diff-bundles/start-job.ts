import { buildEhrStartResourceDiffBundlesHandler } from "@metriport/core/external/ehr/bundle/create-resource-diff-bundles/steps/start/ehr-start-resource-diff-bundles-factory";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { createPatientJob } from "../../../../../command/job/patient/create";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";
import {
  StartCreateResourceDiffBundlesJobParams,
  getCreateResourceDiffBundlesJobType,
} from "../../utils/job";

/**
 * Starts the resource diff job to produce the resource type bundles containing
 * the resources in Metriport that are not in the EHR, or vice versa.
 *
 * @param ehr - The EHR source.
 * @param cxId - The cxId of the patient.
 * @param practiceId - The practice id of the patient.
 * @param patientId - The patient id of the patient.
 * @param direction - The direction of the resource diff bundles to create.
 * @param requestId - The request id of the job. (optional, defaults to a new UUID)
 */
export async function startCreateResourceDiffBundlesJob({
  ehr,
  cxId,
  practiceId,
  patientId,
  direction,
  requestId,
}: StartCreateResourceDiffBundlesJobParams): Promise<string> {
  const existingPatient = await getPatientMappingOrFail({
    cxId,
    externalId: patientId,
    source: ehr,
  });
  const metriportPatient = await getPatientOrFail({
    cxId,
    id: existingPatient.patientId,
  });
  const metriportPatientId = metriportPatient.id;
  const job = await createPatientJob({
    cxId,
    patientId: metriportPatientId,
    jobType: getCreateResourceDiffBundlesJobType(ehr, direction),
    jobGroupId: patientId,
    requestId,
    limitedToOneRunningJob: true,
  });
  const jobId = job.id;
  const ehrResourceDiffHandler = buildEhrStartResourceDiffBundlesHandler();
  ehrResourceDiffHandler
    .startResourceDiffBundles({
      ehr,
      cxId,
      practiceId,
      metriportPatientId,
      ehrPatientId: patientId,
      jobId,
      direction,
    })
    .catch(processAsyncError(`${ehr} startResourceDiffBundles direction ${direction}`));
  return jobId;
}
