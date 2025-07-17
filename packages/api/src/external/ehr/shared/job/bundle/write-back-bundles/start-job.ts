import { BadRequestError } from "@metriport/shared";
import { createPatientJob } from "../../../../../../command/job/patient/create";
import { getPatientJobByIdOrFail } from "../../../../../../command/job/patient/get";
import { validatePatientAndLatestJobStatus } from "../../../command/job/validate-patient-and-lastest-job-status";
import {
  StartBundlesJobParams,
  getCreateResourceDiffBundlesJobType,
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
 * @param resourceType - The resource type of the bundles to write back.
 * @param createResourceDiffBundlesJobId - The job id of the create resource diff bundles job from which the bundles were created.
 * @param requestId - The request id of the job. Optional.
 * @returns The job id of the resource diff bundles job.
 */
export async function startWriteBackBundlesJob({
  ehr,
  cxId,
  practiceId,
  ehrPatientId,
  resourceType,
  createResourceDiffBundlesJobId,
  requestId,
}: StartBundlesJobParams & {
  resourceType: string;
  createResourceDiffBundlesJobId: string;
}): Promise<string> {
  const jobGroupId = ehrPatientId;
  const jobType = getWriteBackBundlesJobType(ehr, resourceType);
  const runUrl = getWriteBackBundlesRunUrl(ehr);
  const createResourceDiffBundlesJob = await getPatientJobByIdOrFail({
    cxId,
    jobId: createResourceDiffBundlesJobId,
  });
  if (createResourceDiffBundlesJob.jobType !== getCreateResourceDiffBundlesJobType(ehr)) {
    throw new BadRequestError(
      "Create resource diff bundles job is not a create resource diff bundles job",
      undefined,
      {
        createResourceDiffBundlesJobId,
        createResourceDiffBundlesJobType: createResourceDiffBundlesJob.jobType,
      }
    );
  }
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
      resourceType,
      createResourceDiffBundlesJobId,
    },
  });
  return job.id;
}
