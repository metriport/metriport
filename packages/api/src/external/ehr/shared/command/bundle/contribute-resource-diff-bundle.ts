import { isAthenaCustomFieldsEnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
import { BundleType } from "@metriport/core/external/ehr/bundle/bundle-shared";
import {
  fetchBundle,
  FetchBundleParams,
} from "@metriport/core/external/ehr/bundle/command/fetch-bundle";
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
 * @param resourceType - The resource type.
 * @param jobId - The job ID.
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
  const metriportPatientId = patientMapping.patientId;
  const fetchParams: FetchBundleParams = {
    ehr,
    cxId,
    ehrPatientId,
    resourceType,
    metriportPatientId,
    bundleType: BundleType.RESOURCE_DIFF_DATA_CONTRIBUTION,
    jobId,
  };
  const [metriportPatient, bundle] = await Promise.all([
    getPatientOrFail({ cxId, id: metriportPatientId }),
    fetchBundle(fetchParams),
  ]);
  if (!bundle?.bundle.entry || bundle.bundle.entry.length < 1) return;
  if (await isAthenaCustomFieldsEnabledForCx(cxId)) return;
  await handleDataContribution({
    requestId: uuidv7(),
    patient: metriportPatient,
    cxId,
    bundle: {
      resourceType: "Bundle",
      type: "collection",
      entry: bundle.bundle.entry,
    },
  });
}
