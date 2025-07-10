import { BadRequestError } from "@metriport/shared";
import { JobStatus } from "@metriport/shared/domain/job/job-status";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";
import { getLatestPatientJob } from "../../../../../command/job/patient/get";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";

/**
 * Validates that the EHR patient and there is no current job with the given statuses for the patient.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param ehrPatientId - The EHR patient ID.
 * @param jobType - The job type.
 * @param jobGroupId - The job group ID.
 * @param jobStatuses - The job statuses to validate. If there is a job with the given statuses, the function will throw an error.
 * @returns The Metriport patient ID.
 * @throws BadRequestError if there is a job with one of the given statuses.
 */
export async function validatePatientAndLatestJobStatus({
  ehr,
  cxId,
  ehrPatientId,
  jobType,
  jobGroupId,
  jobStatuses,
}: {
  ehr: EhrSource;
  cxId: string;
  ehrPatientId: string;
  jobType: string;
  jobGroupId: string;
  jobStatuses: JobStatus[];
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
  const matchingJob = await getLatestPatientJob({
    cxId,
    patientId: metriportPatientId,
    jobType,
    jobGroupId,
    status: jobStatuses,
  });
  if (matchingJob) {
    throw new BadRequestError("Found a job with in one of the given statuses", undefined, {
      cxId,
      metriportPatientId,
      ehrPatientId,
      matchingJobId: matchingJob.id,
      jobStatuses: jobStatuses.join(", "),
    });
  }
  return metriportPatientId;
}
