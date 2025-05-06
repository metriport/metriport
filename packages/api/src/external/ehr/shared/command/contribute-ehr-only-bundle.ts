import { BundleType } from "@metriport/core/external/ehr/bundle/bundle-shared";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import axios from "axios";
import { getPatientMappingOrFail } from "../../../../command/mapping/patient";
import { handleDataContribution } from "../../../../command/medical/patient/data-contribution/handle-data-contributions";
import { getPatientOrFail } from "../../../../command/medical/patient/get-patient";
import { getResourceDiffBundlesJobPayload } from "../job/create-resource-diff-bundles/get-job-payload";
import { ContributeEhrOnlyBundleParams } from "../utils/bundle";

/**
 * Fetch the pre-signed URLs for the EHR only bundles, fetch the bundles and contribute them
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID of the patient
 * @param practiceId - The practice id of the EHR patient.
 * @param patientId - The patient id of the patient.
 * @param jobId - The job id of the resource diff bundles job.
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
    jobId,
    bundleType: BundleType.RESOURCE_DIFF_EHR_ONLY,
  });
  if (!jobPayload.response) return;
  const existingPatient = await getPatientMappingOrFail({
    cxId,
    externalId: patientId,
    source: ehr,
  });
  const metriportPatient = await getPatientOrFail({ cxId, id: existingPatient.patientId });
  const { preSignedUrls } = jobPayload.response;
  const requestId = uuidv7();
  for (const url of preSignedUrls) {
    const response = await axios.get(url);
    const bundle = response.data;
    await handleDataContribution({
      cxId,
      patient: metriportPatient,
      bundle,
      requestId,
    });
  }
}
