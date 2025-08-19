import { isAthenaCustomFieldsEnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
import { BundleType } from "@metriport/core/external/ehr/bundle/bundle-shared";
import {
  fetchBundle,
  FetchBundleParams,
} from "@metriport/core/external/ehr/bundle/command/fetch-bundle";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { MetriportError } from "@metriport/shared";
import { healthieSecondaryMappingsSchema } from "@metriport/shared/interface/external/ehr/healthie/cx-mapping";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getCxMappingsByCustomer } from "../../../../../command/mapping/cx";
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
  if (ehr === EhrSources.healthie) {
    const cxMappings = await getCxMappingsByCustomer({ cxId, source: EhrSources.healthie });
    const cxMapping = cxMappings[0];
    if (!cxMapping) {
      throw new MetriportError("Healthie cx mapping not found", undefined, {
        cxId,
        source: EhrSources.healthie,
      });
    }
    if (cxMappings.length > 1) {
      throw new MetriportError("Multiple Healthie cx mappings found", undefined, {
        cxId,
        source: EhrSources.healthie,
      });
    }
    if (!cxMapping.secondaryMappings) {
      throw new MetriportError("Healthie secondary mappings not found", undefined, {
        externalId: cxMapping.externalId,
        source: EhrSources.healthie,
      });
    }
    const secondaryMappings = healthieSecondaryMappingsSchema.parse(cxMapping.secondaryMappings);
    if (secondaryMappings.contributionDisabled) return;
  }
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
