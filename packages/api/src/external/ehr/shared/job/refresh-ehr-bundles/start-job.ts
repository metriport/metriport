import { buildEhrRefreshEhrBundlesHandler } from "@metriport/core/external/ehr/bundle/refresh-ehr-bundles/ehr-refresh-ehr-bundles-factory";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { createPatientJob } from "../../../../../command/job/patient/create";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";
import { StartRefreshEhrBundlesJobParams, getRefreshEhrBundlesJobType } from "../../utils/job";

/**
 * Starts the refresh EHR bundles job to produce the resource type bundles containing
 * the resources in EHR.
 *
 * @param ehr - The EHR source.
 * @param cxId - The cxId of the patient.
 * @param practiceId - The practice id of the patient.
 * @param patientId - The patient id of the patient.
 * @param requestId - The request id of the job. (optional, defaults to a new UUID)
 */
export async function startRefreshEhrBundlesJob({
  ehr,
  cxId,
  practiceId,
  patientId,
  requestId,
}: StartRefreshEhrBundlesJobParams): Promise<string> {
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
