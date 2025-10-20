import { createPatientJob } from "../../../../../../command/job/patient/create";
import { validatePatientAndLatestJobStatus } from "../../../command/job/validate-patient-and-lastest-job-status";
import {
  StartBundlesJobParams,
  getCreateResourceDiffBundlesJobType,
  getCreateResourceDiffBundlesRunUrl,
} from "../../../utils/job";

/**
 * Starts the resource diff job to produce the resource type bundles containing
 * the resources in Metriport that are not in the EHR and vice versa.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID of the patient.
 * @param practiceId - The practice id of the EHR patient.
 * @param ehrPatientId - The patient id of the EHR patient.
 * @param requestId - The request id of the job. Opional.
 * @returns The job id of the resource diff bundles job.
 */
export async function startCreateResourceDiffBundlesJob({
  ehr,
  cxId,
  practiceId,
  ehrPatientId,
  requestId,
}: StartBundlesJobParams): Promise<string> {
  const jobGroupId = ehrPatientId;
  const jobType = getCreateResourceDiffBundlesJobType(ehr);
  const runUrl = getCreateResourceDiffBundlesRunUrl(ehr);
  const metriportPatientId = await validatePatientAndLatestJobStatus({
    ehr,
    cxId,
    ehrPatientId,
    jobType,
    jobGroupId,
    jobStatuses: ["waiting", "processing"],
  });
  const job = await createPatientJob({
    cxId,
    patientId: metriportPatientId,
    jobType,
    jobGroupId,
    requestId,
    scheduledAt: undefined,
    runUrl,
    paramsOps: {
      practiceId,
      ehrPatientId,
    },
  });
  return job.id;
}
