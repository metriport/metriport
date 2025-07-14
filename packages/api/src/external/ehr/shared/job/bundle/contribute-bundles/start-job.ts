import { createPatientJob } from "../../../../../../command/job/patient/create";
import { getPatientJobByIdOrFail } from "../../../../../../command/job/patient/get";
import { validatePatientAndLatestJobStatus } from "../../../command/job/validate-patient-and-lastest-job-status";
import {
  StartBundlesJobParams,
  getContributeBundlesJobType,
  getContributeBundlesRunUrl,
  getCreateResourceDiffBundlesJobType,
} from "../../../utils/job";

/**
 * Starts the contribute bundles job to contribute the resource type bundles to the EHR.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID of the patient.
 * @param practiceId - The practice id of the EHR patient.
 * @param ehrPatientId - The patient id of the EHR patient.
 * @param resourceType - The resource type of the bundles to contribute.
 * @param createResourceDiffBundlesJobId - The job id of the create resource diff bundles job from which the bundles were created.
 * @param requestId - The request id of the job. Opional.
 * @returns The job id of the resource diff bundles job.
 */
export async function startContributeBundlesJob({
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
  const jobType = getContributeBundlesJobType(ehr, resourceType);
  const runUrl = getContributeBundlesRunUrl(ehr);
  const createResourceDiffBundlesJob = await getPatientJobByIdOrFail({
    cxId,
    jobId: createResourceDiffBundlesJobId,
  });
  if (createResourceDiffBundlesJob.jobType !== getCreateResourceDiffBundlesJobType(ehr)) {
    throw new Error("Create resource diff bundles job is not a create resource diff bundles job");
  }
  if (createResourceDiffBundlesJob.status !== "completed") {
    throw new Error("Create resource diff bundles job is not completed");
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
