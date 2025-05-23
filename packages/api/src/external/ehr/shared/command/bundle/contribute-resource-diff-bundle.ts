import { BundleType } from "@metriport/core/external/ehr/bundle/bundle-shared";
import { fetchBundle } from "@metriport/core/external/ehr/bundle/command/fetch-bundle";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { handleDataContribution } from "../../../../../command/medical/patient/data-contribution/handle-data-contributions";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";
import { ContributeBundleParams } from "../../utils/bundle/types";

/**
 * Contribute the resource diff bundle
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID of the patient.
 * @param ehrPatientId - The patient id of the EHR patient.
 * @param presignedUrl - The presigned URL of the bundle.
 */
export async function contributeResourceDiffBundle({
  ehr,
  cxId,
  ehrPatientId,
  resourceType,
  jobId,
}: ContributeBundleParams): Promise<void> {
  const patientMapping = await getPatientMappingOrFail({
    cxId,
    externalId: ehrPatientId,
    source: ehr,
  });
  const patient = await getPatientOrFail({ cxId, id: patientMapping.patientId });
  const bundle = await fetchBundle({
    ehr,
    cxId,
    metriportPatientId: patientMapping.patientId,
    ehrPatientId,
    bundleType: BundleType.RESOURCE_DIFF_DATA_CONTRIBUTION,
    resourceType,
    jobId,
  });
  if (!bundle || !bundle.bundle || !bundle.bundle.entry) return;
  await handleDataContribution({
    requestId: uuidv7(),
    patient,
    cxId,
    bundle: {
      resourceType: "Bundle",
      type: "collection",
      entry: bundle.bundle.entry,
    },
  });
}
