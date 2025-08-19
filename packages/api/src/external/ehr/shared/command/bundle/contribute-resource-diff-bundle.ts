import { Bundle, BundleEntry, Encounter, Resource } from "@medplum/fhirtypes";
import { getEncounterAppointmentTypeIdExtension } from "@metriport/core/external/ehr/athenahealth/index";
import { BundleType } from "@metriport/core/external/ehr/bundle/bundle-shared";
import { createOrReplaceBundle } from "@metriport/core/external/ehr/bundle/command/create-or-replace-bundle";
import {
  fetchBundle,
  FetchBundleParams,
} from "@metriport/core/external/ehr/bundle/command/fetch-bundle";
import { createOrReplaceDocument } from "@metriport/core/external/ehr/document/command/create-or-replace-document";
import { fetchDocument } from "@metriport/core/external/ehr/document/command/fetch-document";
import { DocumentType } from "@metriport/core/external/ehr/document/document-shared";
import { artifactRelatedArtifactUrl } from "@metriport/core/external/fhir/shared/extensions/derived-from";
import { buildResourceReference } from "@metriport/core/external/fhir/shared/index";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { log, out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { errorToString, MetriportError } from "@metriport/shared";
import { athenaSecondaryMappingsSchema } from "@metriport/shared/interface/external/ehr/athenahealth/cx-mapping";
import { createBundleFromResourceList } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import axios from "axios";
import { partition } from "lodash";
import { getCxMappingOrFail } from "../../../../../command/mapping/cx";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { getUploadUrlAndCreateDocRef } from "../../../../../command/medical/document/get-upload-url-and-create-doc-ref";
import { handleDataContribution } from "../../../../../command/medical/patient/data-contribution/handle-data-contributions";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";
import { getAthenaPracticeIdFromPatientId } from "../../../athenahealth/shared";
import { ContributeBundleParams } from "../../utils/bundle/types";

const uploadJobId = "upload";

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
  if (ehr === EhrSources.athena) {
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
      await dangerouslyRemoveEncounterEntriesWithBlacklistedAppointmentType({
        ehr,
        cxId,
        metriportPatientId,
        ehrPatientId,
        resourceType,
        jobId,
        bundle: bundle.bundle,
        blacklistedAppointmentTypes:
          secondaryMappings.contributionEncounterAppointmentTypesBlacklist,
      });
    }
    if (secondaryMappings.contributionEncounterSummariesEnabled && resourceType === "Encounter") {
      await uploadEncounterSummaries({
        ehr,
        cxId,
        metriportPatientId,
        ehrPatientId,
        bundle: bundle.bundle,
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
 * @param ehr - The EHR source.
 * @param cxId - The CX ID of the patient.
 * @param metriportPatientId - The Metriport patient ID.
 * @param ehrPatientId - The patient id of the EHR patient.
 * @param resourceType - The resource type.
 * @param jobId - The job ID.
 * @param params.bundle - The FHIR Bundle to mutate.
 * @param params.blacklistedAppointmentTypes - The list of appointment types to exclude.
 */
async function dangerouslyRemoveEncounterEntriesWithBlacklistedAppointmentType({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  resourceType,
  jobId,
  bundle,
  blacklistedAppointmentTypes,
}: {
  ehr: EhrSources;
  cxId: string;
  metriportPatientId: string;
  ehrPatientId: string;
  resourceType: string;
  jobId: string;
  bundle: Bundle;
  blacklistedAppointmentTypes: string[];
}): Promise<void> {
  if (!bundle.entry || bundle.entry.length < 1) return;
  const encounters: Encounter[] = bundle.entry
    .filter(entry => entry.resource?.resourceType === "Encounter")
    .map(entry => entry.resource as Encounter);
  if (encounters.length < 1) return;
  const encountersToRemoveReferences: string[] = [];
  const encountersToRemoveIds = encounters
    .filter((encounter: Encounter) => {
      const appointmentTypeExtension = getEncounterAppointmentTypeIdExtension(encounter);
      if (!appointmentTypeExtension || !appointmentTypeExtension.valueString) return true;
      return blacklistedAppointmentTypes.includes(appointmentTypeExtension.valueString);
    })
    .flatMap(encounter => {
      if (!encounter.id) return [];
      encountersToRemoveReferences.push(buildResourceReference(encounter));
      return [encounter.id];
    });
  const setOfResourceIdsToRemove = new Set<string>(encountersToRemoveIds);
  for (const entry of bundle.entry) {
    if (!entry.resource || !entry.resource.id) continue;
    if (doesResourceReferenceEncounter(entry.resource, encountersToRemoveReferences)) {
      setOfResourceIdsToRemove.add(entry.resource.id);
    }
  }
  const [resourcesToRemove, resourcesToKeep] = partition(
    bundle.entry,
    (entry: BundleEntry<Resource>) => {
      if (!entry.resource || !entry.resource.id) return false;
      return setOfResourceIdsToRemove.has(entry.resource.id);
    }
  );
  bundle.entry = resourcesToKeep;
  await createContributionRemovedBundle({
    ehr,
    cxId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
    jobId,
    resourcesToRemove,
  });
}

/**
 * Determines if the given FHIR resource contains a reference to any of the specified encounter references.
 *
 * This checks for a reference to an encounter in the resource's `encounter` or `context` property,
 * and returns true if any such reference matches one in the provided list.
 *
 * @param resource - The FHIR resource to inspect for encounter references.
 * @param encounterReferences - An array of encounter reference strings (e.g., "Encounter/123").
 * @returns True if the resource refers to any encounter in the list; otherwise, false.
 */
function doesResourceReferenceEncounter(
  resource: Resource,
  encounterReferences: string[]
): boolean {
  if ("encounter" in resource) {
    const encounter = resource.encounter;
    if (!encounter || !encounter.reference) return false;
    return encounterReferences.includes(encounter.reference);
  }
  if ("context" in resource) {
    const context = resource.context;
    if (!context || !("reference" in context) || !context.reference) return false;
    return encounterReferences.includes(context.reference);
  }
  return false;
}

/**
 * Creates a contribution removed bundle. This is for auditing purposes only.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID of the patient.
 * @param metriportPatientId - The Metriport patient ID.
 * @param ehrPatientId - The patient id of the EHR patient.
 * @param resourceType - The resource type.
 * @param jobId - The job ID.
 * @param resourcesToRemove - The resources to remove.
 */
async function createContributionRemovedBundle({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  resourceType,
  jobId,
  resourcesToRemove,
}: {
  ehr: EhrSources;
  cxId: string;
  metriportPatientId: string;
  ehrPatientId: string;
  resourceType: string;
  jobId: string;
  resourcesToRemove: BundleEntry<Resource>[];
}): Promise<void> {
  try {
    await createOrReplaceBundle({
      ehr,
      cxId,
      ehrPatientId,
      metriportPatientId,
      bundleType: BundleType.RESOURCE_DIFF_DATA_CONTRIBUTION_REMOVED,
      bundle: createBundleFromResourceList(
        resourcesToRemove.flatMap(entry => {
          if (!entry.resource) return [];
          return [entry.resource];
        })
      ),
      resourceType,
      jobId,
      mixedResourceTypes: true,
    });
  } catch (error) {
    out(
      `createContributionRemovedBundle - metriportPatientId ${metriportPatientId} ehrPatientId ${ehrPatientId} resourceType ${resourceType}`
    ).log(`Error creating contribution removed bundle. Cause: ${errorToString(error)}`);
  }
}

/**
 * Uploads encounter summaries.
 *
 * This function fetches encounter summaries for each encounter in the bundle and uploads them to the FHIR server.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID of the patient.
 * @param metriportPatientId - The Metriport patient ID.
 * @param ehrPatientId - The patient id of the EHR patient.
 * @param bundle - The FHIR bundle containing the encounters.
 */
async function uploadEncounterSummaries({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  bundle,
}: {
  ehr: EhrSources;
  cxId: string;
  metriportPatientId: string;
  ehrPatientId: string;
  bundle: Bundle;
}): Promise<void> {
  if (!bundle.entry || bundle.entry.length < 1) return;
  const encounterSummariesToUpload: { encounter: Encounter; summary: string }[] = [];
  for (const entry of bundle.entry) {
    if (!entry.resource || !entry.resource.id || entry.resource.resourceType !== "Encounter") {
      continue;
    }
    const predecessor = getPredecessorExtensionValue(entry.resource);
    if (!predecessor) continue;
    const uploadedSummary = await fetchDocument({
      ehr,
      cxId,
      metriportPatientId,
      ehrPatientId,
      documentType: DocumentType.HTML,
      resourceType: "Encounter",
      resourceId: predecessor,
      jobId: uploadJobId,
    });
    if (uploadedSummary) continue;
    const summary = await fetchDocument({
      ehr,
      cxId,
      metriportPatientId,
      ehrPatientId,
      documentType: DocumentType.HTML,
      resourceType: "Encounter",
      resourceId: predecessor,
    });
    if (!summary) continue;
    encounterSummariesToUpload.push({ encounter: entry.resource, summary: summary.file });
  }
  if (encounterSummariesToUpload.length < 1) return;
  const uploadEncounterSummariesErrors: { encounterId: string; error: unknown }[] = [];
  await executeAsynchronously(
    encounterSummariesToUpload,
    async encounterSummary => {
      try {
        const { uploadUrl } = await getUploadUrlAndCreateDocRef({
          cxId,
          patientId: metriportPatientId,
          docRefDraft: {
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
              encounter: [{ reference: `Encounter/${encounterSummary.encounter.id}` }],
            },
          },
        });
        await axios.put(uploadUrl, encounterSummary.summary, {
          headers: {
            "Content-Length": Buffer.byteLength(encounterSummary.summary),
            "Content-Type": "text/html",
          },
        });
        const predecessor = getPredecessorExtensionValue(encounterSummary.encounter);
        if (!predecessor) return;
        await createOrReplaceDocument({
          ehr,
          cxId,
          metriportPatientId,
          ehrPatientId,
          documentType: DocumentType.HTML,
          payload: encounterSummary.summary,
          resourceType: "Encounter",
          resourceId: predecessor,
          jobId: uploadJobId,
        });
      } catch (error) {
        if (!encounterSummary.encounter.id) return;
        log(
          `Failed to upload encounter summary ${
            encounterSummary.encounter.id
          }. Cause: ${errorToString(error)}`
        );
        uploadEncounterSummariesErrors.push({ error, encounterId: encounterSummary.encounter.id });
      }
    },
    {
      numberOfParallelExecutions: 1,
    }
  );
  if (uploadEncounterSummariesErrors.length > 0) {
    const msg = `Failure while uploading some encounter summaries @ ${ehr}`;
    capture.message(msg, {
      extra: {
        uploadEncounterSummariesArgsCount: encounterSummariesToUpload.length,
        uploadEncounterSummariesErrorsCount: uploadEncounterSummariesErrors.length,
        errors: uploadEncounterSummariesErrors,
        context: `${ehr}.upload-encounter-summaries`,
      },
      level: "warning",
    });
  }
}

/**
 * Returns the value of the predecessor extension from an Encounter resource.
 *
 * @param encounter - The FHIR Encounter resource.
 * @returns The value of the predecessor extension, or undefined if not present.
 */
function getPredecessorExtensionValue(encounter: Encounter): string | undefined {
  const extension = encounter.extension;
  if (!extension || extension.length < 1) return undefined;
  const predecessorExtension = extension.find(
    ext =>
      ext.url === artifactRelatedArtifactUrl && ext.valueRelatedArtifact?.type === "predecessor"
  );
  return predecessorExtension?.valueRelatedArtifact?.display;
}
