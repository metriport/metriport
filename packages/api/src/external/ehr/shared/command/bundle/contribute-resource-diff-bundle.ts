import { Bundle, BundleEntry, Encounter, Extension, Resource } from "@medplum/fhirtypes";
import { isAthenaCustomFieldsEnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
import { encounterAppointmentExtensionUrl } from "@metriport/core/external/ehr/athenahealth/index";
import { BundleType } from "@metriport/core/external/ehr/bundle/bundle-shared";
import {
  fetchBundle,
  FetchBundleParams,
} from "@metriport/core/external/ehr/bundle/command/fetch-bundle";
import { fetchDocument } from "@metriport/core/external/ehr/document/command/fetch-document";
import { DocumentType } from "@metriport/core/external/ehr/document/document-shared";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { MetriportError } from "@metriport/shared";
import { athenaSecondaryMappingsSchema } from "@metriport/shared/interface/external/ehr/athenahealth/cx-mapping";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import axios from "axios";
import { getCxMappingOrFail } from "../../../../../command/mapping/cx";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { getUploadUrlAndCreateDocRef } from "../../../../../command/medical/document/get-upload-url-and-create-doc-ref";
import { handleDataContribution } from "../../../../../command/medical/patient/data-contribution/handle-data-contributions";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";
import { getAthenaPracticeIdFromPatientId } from "../../../athenahealth/shared";
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
  if (await isAthenaCustomFieldsEnabledForCx(cxId)) {
    const athenaPracticeId = getAthenaPracticeIdFromPatientId(patientMapping.externalId);
    const cxMappingLookupParams = { externalId: athenaPracticeId, source: EhrSources.athena };
    const cxMapping = await getCxMappingOrFail(cxMappingLookupParams);
    if (!cxMapping.secondaryMappings) {
      throw new MetriportError("Athena secondary mappings not found", undefined, {
        externalId: athenaPracticeId,
        source: EhrSources.athena,
      });
    }
    const secondaryMappings = athenaSecondaryMappingsSchema.parse(cxMapping.secondaryMappings);
    if (secondaryMappings.contributionEncounterAppointmentTypesBlacklist) {
      dangerouslyRemoveEncounterEntriesWithBlacklistedAppointmentType({
        bundle: bundle.bundle,
        blacklistedAppointmentTypes:
          secondaryMappings.contributionEncounterAppointmentTypesBlacklist,
      });
    }
    if (secondaryMappings.contributionEncounterSummariesEnabled) {
      await uploadEncounterSummaries({
        bundle: bundle.bundle,
        cxId,
        metriportPatientId,
        ehrPatientId,
      });
    }
  }
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

/**
 * Removes Encounter entries from the bundle whose appointment types are blacklisted or who do not
 * have the appointment type extension.
 *
 * This function mutates the provided bundle by filtering out Encounter resources that have
 * appointment types present in the blacklist. It also removes any resources referenced by
 * those Encounters.
 *
 * @param params - The parameters for the function.
 * @param params.bundle - The FHIR Bundle to mutate.
 * @param params.blacklistedAppointmentTypes - The list of appointment types to exclude.
 */
async function dangerouslyRemoveEncounterEntriesWithBlacklistedAppointmentType({
  bundle,
  blacklistedAppointmentTypes,
}: {
  bundle: Bundle;
  blacklistedAppointmentTypes: string[];
}): Promise<void> {
  if (!bundle.entry) return;
  const encounters: Encounter[] = bundle.entry
    .filter(entry => entry.resource?.resourceType === "Encounter")
    .map(entry => entry.resource as Encounter);
  const encountersToRemove = encounters.filter((encounter: Encounter) => {
    if (!encounter.extension) return true;
    const appointmentTypeExtension = encounter.extension.find(
      (ext: Extension) => ext.url === encounterAppointmentExtensionUrl
    );
    if (!appointmentTypeExtension) return true;
    return blacklistedAppointmentTypes.includes(appointmentTypeExtension.valueString as string);
  });
  const encounterReferences = encountersToRemove.map(encounter => `Encounter/${encounter.id}`);
  const resourcesToRemove = new Set<string>();
  for (const encounter of encountersToRemove) {
    if (!encounter.id) continue;
    resourcesToRemove.add(encounter.id);
  }
  for (const entry of bundle.entry) {
    if (!entry.resource) continue;
    if (!entry.resource.id) continue;
    if (doesResourceReferToEncounter(entry.resource, encounterReferences)) {
      resourcesToRemove.add(entry.resource.id);
    }
  }
  bundle.entry = bundle.entry.filter((entry: BundleEntry<Resource>) => {
    if (!entry.resource) return true;
    if (!entry.resource.id) return true;
    return !resourcesToRemove.has(entry.resource.id);
  });
}

/**
 * Returns a set of resource IDs referenced by the given FHIR resource.
 *
 * This function traverses the resource object and collects all values of properties named "reference"
 * that are strings in the format "ResourceType/id", extracting the "id" part.
 *
 * @param resource - The FHIR resource from which to extract referenced IDs.
 * @returns A set containing the referenced resource IDs.
 */
function doesResourceReferToEncounter(resource: Resource, encounterReferences: string[]): boolean {
  if ("encounter" in resource) {
    const encounter = resource.encounter;
    if (!encounter || !encounter.reference) return false;
    return encounterReferences.includes(encounter.reference);
  }
  return false;
}

/**
 * Uploads encounter summaries to the FHIR server.
 *
 * This function fetches encounter summaries for each encounter in the bundle and uploads them to the FHIR server.
 *
 * @param bundle - The FHIR bundle containing the encounters.
 * @param cxId - The CX ID of the patient.
 * @param metriportPatientId - The Metriport patient ID.
 * @param ehrPatientId - The EHR patient ID.
 */
async function uploadEncounterSummaries({
  bundle,
  cxId,
  metriportPatientId,
  ehrPatientId,
}: {
  bundle: Bundle;
  cxId: string;
  metriportPatientId: string;
  ehrPatientId: string;
}): Promise<void> {
  if (!bundle.entry) return;
  const encounterSummaries: { encounter: Encounter; summary: string }[] = [];
  for (const entry of bundle.entry) {
    if (!entry.resource) continue;
    if (!entry.resource?.id || entry.resource?.resourceType !== "Encounter") continue;
    const summary = await fetchDocument({
      ehr: EhrSources.athena,
      cxId,
      metriportPatientId,
      ehrPatientId,
      documentType: DocumentType.HTML,
      resourceType: "Encounter",
      resourceId: entry.resource.id,
    });
    if (!summary) continue;
    encounterSummaries.push({ encounter: entry.resource, summary: summary.file });
  }
  await executeAsynchronously(
    encounterSummaries,
    async encounterSummary => {
      const { uploadUrl } = await getUploadUrlAndCreateDocRef({
        cxId,
        patientId: metriportPatientId,
        inputDocRef: {
          resourceType: "DocumentReference",
          status: "current",
          docStatus: "final",
          description: "Encounter summary",
          type: {
            text: "Summarization of encounter note Narrative",
            coding: [
              {
                code: "67781-5",
                system: "http://loinc.org",
                display: "Summarization of encounter note Narrative",
              },
            ],
          },
          context: {
            period: {
              start: encounterSummary.encounter.period?.start,
              end: encounterSummary.encounter.period?.end,
            },
            facilityType: {
              text: encounterSummary.encounter.location?.[0]?.location?.display,
            },
          },
        },
      });
      axios.post(uploadUrl, encounterSummary.summary, {
        headers: {
          "Content-Type": "text/html",
        },
      });
    },
    {
      numberOfParallelExecutions: 1,
    }
  );
}
