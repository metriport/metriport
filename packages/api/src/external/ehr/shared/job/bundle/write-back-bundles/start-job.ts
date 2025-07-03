import { BadRequestError } from "@metriport/shared";
import { createPatientJob } from "../../../../../../command/job/patient/create";
import { getLatestPatientJob } from "../../../../../../command/job/patient/get";
import { getPatientMappingOrFail } from "../../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../../command/medical/patient/get-patient";
import {
  StartCreateResourceDiffBundlesJobParams,
  getWriteBackBundlesJobType,
  getWriteBackBundlesRunUrl,
} from "../../../utils/job";

/**
 * Starts the write back job to write the resource type bundles to the EHR.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID of the patient.
 * @param practiceId - The practice id of the EHR patient.
 * @param ehrPatientId - The patient id of the EHR patient.
 * @param createResourceDiffBundlesJobId - The job id of the create resource diff bundles job from which the bundles were created.
 * @param requestId - The request id of the job. Optional, defaults to a new UUID.
 * @returns The job id of the resource diff bundles job.
 */
export async function startWriteBackBundlesJob({
  ehr,
  cxId,
  practiceId,
  ehrPatientId,
  createResourceDiffBundlesJobId,
  requestId,
}: StartCreateResourceDiffBundlesJobParams & {
  createResourceDiffBundlesJobId: string;
}): Promise<string> {
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
  const jobType = getWriteBackBundlesJobType(ehr);
  const runUrl = getWriteBackBundlesRunUrl(ehr);
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
    runUrl,
    paramsOps: {
      practiceId,
      ehrPatientId,
      createResourceDiffBundlesJobId,
    },
  });
  return job.id;
}
