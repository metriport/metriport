import { BadRequestError } from "../../../../../../../../shared/dist";
import { createPatientJob } from "../../../../../../command/job/patient/create";
import { getLatestPatientJob } from "../../../../../../command/job/patient/get";
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
  const jobType = getCreateResourceDiffBundlesJobType(ehr);
  const jobGroupId = ehrPatientId;
  const runningJob = await getLatestPatientJob({
    cxId,
    patientId: metriportPatientId,
    jobType,
    jobGroupId,
    status: ["waiting", "processing"],
  });
  if (runningJob) {
    throw new BadRequestError("Only one job can be running at a time", undefined, {
      cxId,
      metriportPatientId,
      ehrPatientId,
      runningJobId: runningJob.id,
    });
  }
  const job = await createPatientJob({
    cxId,
    patientId: metriportPatientId,
    jobType,
    jobGroupId,
    requestId,
    scheduledAt: undefined,
    paramsOps: {
      practiceId,
      ehrPatientId,
    },
  });
  return job.id;
}
