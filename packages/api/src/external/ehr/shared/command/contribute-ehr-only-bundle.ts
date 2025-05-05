import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { ResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import axios from "axios";
import { getPatientMappingOrFail } from "../../../../command/mapping/patient";
import { handleDataContribution } from "../../../../command/medical/patient/data-contribution/handle-data-contributions";
import { getResourceDiffBundlesJobPayload } from "../job/create-resource-diff-bundles/get-job-payload";
import { ContributeEhrOnlyBundleParams } from "../utils/bundle";
/**
 * Fetch the pre-signed URLs for the resource diff bundles
 *
 * @param ehr - The EHR source.
 * @param cxId The CX ID of the patient
 * @param practiceId - The practice id of the EHR patient.
 * @param patientId - The patient id of the patient.
 * @param jobId The job id of the job.
 * @throws NotFoundError if no job is found
 */
export async function contributeEhrOnlyBundle({
  ehr,
  cxId,
  practiceId,
  patientId,
  jobId,
}: ContributeEhrOnlyBundleParams): Promise<void> {
  const jobPayload = await getResourceDiffBundlesJobPayload({
    ehr,
    cxId,
    practiceId,
    patientId,
    direction: ResourceDiffDirection.EHR_ONLY,
    jobId,
  });
  if (!jobPayload.response) return;
  const existingPatient = await getPatientMappingOrFail({
    cxId,
    externalId: patientId,
    source: ehr,
  });
  const metriportPatientId = existingPatient.patientId;
  const { preSignedUrls } = jobPayload.response;
  const requestId = uuidv7();
  for (const url of preSignedUrls) {
    const bundle = await axios.get(url);
    const bundleData = bundle.data;
    await handleDataContribution({
      cxId,
      patientId: metriportPatientId,
      bundle: bundleData,
      requestId,
    });
  }
}
