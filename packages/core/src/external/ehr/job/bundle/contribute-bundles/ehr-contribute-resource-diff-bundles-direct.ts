import { Medication, Patient, Reference, Resource } from "@medplum/fhirtypes";
import { BadRequestError, errorToString, NotFoundError, sleep } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { createBundleFromResourceList } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { uniqBy } from "lodash";
import { setJobEntryStatus } from "../../../../../command/job/patient/api/set-entry-status";
import { executeAsynchronously } from "../../../../../util/concurrency";
import { log } from "../../../../../util/log";
import { capture } from "../../../../../util/notifications";
import { getReferencesFromResources, ReferenceWithIdAndType } from "../../../../fhir/bundle/bundle";
import { isCondition, isPatient } from "../../../../fhir/shared";
import { createPredecessorExtensionRelatedArtifact } from "../../../../fhir/shared/extensions/derived-from";
import { createExtensionDataSource } from "../../../../fhir/shared/extensions/extension";
import { contributeBundle } from "../../../api/job/contribute-bundle";
import { BundleType } from "../../../bundle/bundle-shared";
import { createOrReplaceBundle } from "../../../bundle/command/create-or-replace-bundle";
import { fetchBundle, FetchBundleParams } from "../../../bundle/command/fetch-bundle";
import { getResourceBundleByResourceId } from "../../../command/get-resource-bundle-by-resource-id";
import {
  ContributeResourceDiffBundlesRequest,
  EhrContributeResourceDiffBundlesHandler,
} from "./ehr-contribute-resource-diff-bundles";

dayjs.extend(duration);

const hydrateEhrOnlyResourceAttempts = 3;
const parallelRequests = 2;
const minJitter = dayjs.duration(0, "seconds");
const maxJitter = dayjs.duration(5, "seconds");

const INVISIBLE_WIDE_SPACE = "\u2003";
const EN_DASH = "\u2013";

export class EhrContributeResourceDiffBundlesDirect
  implements EhrContributeResourceDiffBundlesHandler
{
  constructor(private readonly waitTimeInMillis: number = 0) {}

  async contributeResourceDiffBundles(
    payload: ContributeResourceDiffBundlesRequest
  ): Promise<void> {
    const {
      ehr,
      tokenId,
      cxId,
      practiceId,
      metriportPatientId,
      ehrPatientId,
      resourceType,
      createResourceDiffBundlesJobId,
      jobId,
      reportError = true,
    } = payload;
    const entryStatusParams = {
      ehr,
      cxId,
      practiceId,
      patientId: ehrPatientId,
      jobId,
    };
    try {
      const ehrOnlyResources = await getEhrOnlyResourcesFromS3({
        ehr,
        cxId,
        metriportPatientId,
        ehrPatientId,
        resourceType,
        jobId: createResourceDiffBundlesJobId,
      });
      if (ehrOnlyResources.length < 1) {
        await setJobEntryStatus({
          ...entryStatusParams,
          entryStatus: "successful",
        });
        return;
      }
      const hydratedEhrOnlyResources = await hydrateEhrOnlyResources({
        ehr,
        tokenId,
        cxId,
        practiceId,
        metriportPatientId,
        ehrPatientId,
        ehrOnlyResources,
      });
      const preparedAndHydratedEhrOnlyResources = prepareEhrOnlyResourcesForContribution(
        hydratedEhrOnlyResources,
        metriportPatientId,
        ehr
      );
      await createOrReplaceBundle({
        ehr,
        cxId,
        metriportPatientId,
        ehrPatientId,
        bundleType: BundleType.RESOURCE_DIFF_DATA_CONTRIBUTION,
        bundle: createBundleFromResourceList(preparedAndHydratedEhrOnlyResources),
        resourceType,
        jobId,
        mixedResourceTypes: true,
      });
      await contributeBundle({
        ehr,
        cxId,
        patientId: ehrPatientId,
        resourceType,
        jobId,
      });
      await setJobEntryStatus({
        ...entryStatusParams,
        entryStatus: "successful",
      });
    } catch (error) {
      if (reportError) {
        await setJobEntryStatus({
          ...entryStatusParams,
          entryStatus: "failed",
        });
      }
      throw error;
    }
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}

async function getEhrOnlyResourcesFromS3({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  resourceType,
  jobId,
}: Omit<FetchBundleParams, "bundleType">): Promise<Resource[]> {
  const bundle = await fetchBundle({
    ehr,
    cxId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
    bundleType: BundleType.RESOURCE_DIFF_EHR_ONLY,
    jobId,
  });
  if (!bundle?.bundle.entry || bundle.bundle.entry.length < 1) return [];
  return bundle.bundle.entry.flatMap(entry => {
    if (!entry.resource) return [];
    return [entry.resource];
  });
}

async function hydrateEhrOnlyResources({
  ehr,
  tokenId,
  cxId,
  practiceId,
  metriportPatientId,
  ehrPatientId,
  ehrOnlyResources,
}: {
  ehr: EhrSource;
  tokenId: string | undefined;
  cxId: string;
  practiceId: string;
  metriportPatientId: string;
  ehrPatientId: string;
  ehrOnlyResources: Resource[];
}): Promise<Resource[]> {
  const hydratedEhrOnlyResources = [...ehrOnlyResources];
  const fetchedResourceIds = new Set([
    ...hydratedEhrOnlyResources.flatMap(resource => resource.id ?? []),
  ]);
  dangerouslyHydrateMedicationStatement(hydratedEhrOnlyResources);
  for (let i = 0; i < hydrateEhrOnlyResourceAttempts; i++) {
    const { missingReferences } = getReferencesFromResources({
      resourcesToCheckRefs: hydratedEhrOnlyResources,
    });
    if (missingReferences.length < 1) break;
    const hydrationArgs = uniqBy(missingReferences, "id");
    const hydrationErrors: { error: unknown; id: string; type: string }[] = [];
    await executeAsynchronously(
      hydrationArgs,
      async (params: ReferenceWithIdAndType) => {
        const { id, type } = params;
        if (fetchedResourceIds.has(id)) return;
        try {
          const bundle = await getResourceBundleByResourceId({
            ehr,
            ...(tokenId && { tokenId }),
            cxId,
            practiceId,
            metriportPatientId,
            ehrPatientId,
            resourceType: type,
            resourceId: id,
            useCachedBundle: true,
          });
          const resource = bundle.entry?.[0]?.resource;
          if (!resource) return;
          hydratedEhrOnlyResources.push(resource);
        } catch (error) {
          if (error instanceof BadRequestError || error instanceof NotFoundError) return;
          const refToString = JSON.stringify(params);
          log(`Failed to hydrate resource ${refToString}. Cause: ${errorToString(error)}`);
          hydrationErrors.push({ error, ...params });
        } finally {
          fetchedResourceIds.add(id);
        }
      },
      {
        numberOfParallelExecutions: parallelRequests,
        maxJitterMillis: maxJitter.asMilliseconds(),
        minJitterMillis: minJitter.asMilliseconds(),
      }
    );
    if (hydrationErrors.length > 0) {
      const msg = `Failure while hydrating some resources @ EHR`;
      capture.message(msg, {
        extra: {
          hydrationArgsCount: hydrationArgs.length,
          hydrationErrorsCount: hydrationErrors.length,
          hydrationAttempt: i,
          errors: hydrationErrors,
          context: "create-resource-diff-bundles.contribute.hydrateEhrOnlyResources",
        },
      });
    }
  }
  return hydratedEhrOnlyResources;
}

function dangerouslyHydrateMedicationStatement(resources: Resource[]) {
  for (const resource of resources) {
    if (
      resource.id &&
      resource.resourceType === "MedicationStatement" &&
      resource.medicationCodeableConcept
    ) {
      const medicationId = createUuidFromText(`medicationstatement_${resource.id}`);
      const newMedication: Medication = {
        resourceType: "Medication",
        id: medicationId,
        code: resource.medicationCodeableConcept,
        status: "active",
      };
      resource.medicationReference = {
        reference: `Medication/${medicationId}`,
      };
      resources.push(newMedication);
    }
  }
}

function prepareEhrOnlyResourcesForContribution(
  ehrOnlyResources: Resource[],
  metriportPatientId: string,
  ehr: EhrSource
): Resource[] {
  let preparedEhrOnlyResources: Resource[] = [...ehrOnlyResources];
  const resourceIdMap = new Map<string, string>();
  const resourceIdMapReverse = new Map<string, string>();
  for (const resource of ehrOnlyResources) {
    if (!resource.id) continue;
    const oldResourceId = resource.id;
    const newResourceId = isPatient(resource)
      ? metriportPatientId
      : createUuidFromText(`${ehr}_${metriportPatientId}_${oldResourceId}`);
    resourceIdMap.set(newResourceId, oldResourceId);
    resourceIdMapReverse.set(oldResourceId, newResourceId);
  }
  const idsToReplace = reverseSortIds(Array.from(resourceIdMapReverse.keys()));
  for (const oldResourceId of idsToReplace) {
    const newResourceId = resourceIdMapReverse.get(oldResourceId);
    if (!newResourceId) continue;
    preparedEhrOnlyResources = replaceResourceId({
      resources: preparedEhrOnlyResources,
      oldResourceId,
      newResourceId,
    });
  }
  for (const resource of preparedEhrOnlyResources) {
    if (!resource.id) continue;
    const newResourceId = resource.id;
    const oldResourceId = resourceIdMap.get(newResourceId);
    if (!oldResourceId) continue;
    dangerouslyAdjustPatientReference(resource, metriportPatientId);
    dangerouslyAdjustExtensions(resource, oldResourceId, ehr);
    dangerouslyNormalizeResource(resource);
  }
  return preparedEhrOnlyResources;
}

function createPatientReference(metriportPatientId: string): Reference<Patient> {
  return { reference: `Patient/${metriportPatientId}` };
}

function dangerouslyAdjustPatientReference(resource: Resource, metriportPatientId: string) {
  const patientReference = createPatientReference(metriportPatientId);
  if ("subject" in resource) resource.subject = patientReference;
  if ("patient" in resource) resource.patient = patientReference;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dangerouslyAdjustExtensions(resource: any, predecessorId: string, ehr: EhrSource) {
  const predecessorExtension = createPredecessorExtensionRelatedArtifact(predecessorId);
  const dataSourceExtension = createExtensionDataSource(ehr.toUpperCase());
  resource.extension = [...(resource.extension ?? []), predecessorExtension, dataSourceExtension];
}

function dangerouslyNormalizeResource(resource: Resource) {
  if (isCondition(resource)) {
    if (resource.note) {
      resource.note.forEach(note => {
        if (note.text) {
          note.text = note.text
            .replace(new RegExp(INVISIBLE_WIDE_SPACE, "g"), " ")
            .replace(new RegExp(EN_DASH, "g"), "-");
        }
      });
    }
  }
}

function replaceResourceId({
  resources,
  oldResourceId,
  newResourceId,
}: {
  resources: Resource[];
  oldResourceId: string;
  newResourceId: string;
}): Resource[] {
  const resourcesAsString = JSON.stringify(resources);
  const resourcesAsStringWithReplacedId = resourcesAsString.replace(
    new RegExp(oldResourceId, "g"),
    newResourceId
  );
  return JSON.parse(resourcesAsStringWithReplacedId);
}

export function reverseSortIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => {
    if (a.length !== b.length) {
      return b.length - a.length;
    }
    return a > b ? -1 : 1;
  });
}
