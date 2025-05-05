import { buildEhrRefreshEhrBundlesHandler } from "@metriport/core/external/ehr/bundle/refresh-ehr-bundles/ehr-refresh-ehr-bundles-factory";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { createPatientJob } from "../../../../../command/job/patient/create";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";
import { RefreshEhrBundlesJobParams, getRefreshEhrBundlesJobType } from "../../utils/job";

/**
 * Starts the resource diff job to produce the resource type bundles containing
 * the resources in Metriport that are not in the EHR, or vice versa.
 *
 * @param ehr - The EHR source.
 * @param cxId - The cxId of the patient.
 * @param practiceId - The practice id of the patient.
 * @param patientId - The patient id of the patient.
 * @param requestId - The request id of the job. (optional, defaults to a new UUID)
 */
export async function createResourceDiffBundlesJob({
  ehr,
  cxId,
  practiceId,
  patientId,
  requestId,
}: RefreshEhrBundlesJobParams): Promise<string> {
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
    jobType: getRefreshEhrBundlesJobType(ehr),
    jobGroupId: patientId,
    requestId,
    limitedToOneRunningJob: true,
  });
  const jobId = job.id;
  const ehrRefreshHandler = buildEhrRefreshEhrBundlesHandler();
  ehrRefreshHandler
    .refreshEhrBundles({
      ehr,
      cxId,
      practiceId,
      patientId,
      jobId,
    })
    .catch(processAsyncError(`${ehr} refreshEhrBundles`));
  return jobId;
}
