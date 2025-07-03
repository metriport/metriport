import { Condition, Observation, Resource, ResourceType } from "@medplum/fhirtypes";
import {
  BadRequestError,
  createBundleFromResourceList,
  errorToString,
  NotFoundError,
  sleep,
} from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { WriteBackFiltersPerResourceType } from "@metriport/shared/interface/external/ehr/shared";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { setJobEntryStatus } from "../../../../../command/job/patient/api/set-entry-status";
import { executeAsynchronously } from "../../../../../util/concurrency";
import { log, out } from "../../../../../util/log";
import { capture } from "../../../../../util/notifications";
import { getSecondaryMappings } from "../../../api/get-secondary-mappings";
import { BundleType } from "../../../bundle/bundle-shared";
import { createOrReplaceBundle } from "../../../bundle/command/create-or-replace-bundle";
import { fetchBundle, FetchBundleParams } from "../../../bundle/command/fetch-bundle";
import { writeBackResource, WriteBackResourceType } from "../../../command/write-back/shared";
import { ehrCxMappingSecondaryMappingsSchemaMap } from "../../../mappings";
import {
  getObservationLoincCode,
  getObservationObservedDate,
  isChronicCondition,
  isLab,
  isVital,
} from "../../../shared";
import {
  EhrWriteBackResourceDiffBundlesHandler,
  WriteBackResourceDiffBundlesRequest,
} from "./ehr-write-back-resource-diff-bundles";

dayjs.extend(duration);

const parallelRequests = 5;
const delayBetweenRequestBatches = dayjs.duration(2, "seconds");

const supportedWriteBackResourceTypes: ResourceType[] = ["Condition", "Observation"];
export type SupportedWriteBackResourceType = (typeof supportedWriteBackResourceTypes)[number];
export function isSupportedWriteBackResourceType(
  resourceType: string
): resourceType is SupportedWriteBackResourceType {
  return supportedWriteBackResourceTypes.includes(resourceType as ResourceType);
}

export class EhrWriteBackResourceDiffBundlesDirect
  implements EhrWriteBackResourceDiffBundlesHandler
{
  constructor(private readonly waitTimeInMillis: number = 0) {}

  async writeBackResourceDiffBundles(payload: WriteBackResourceDiffBundlesRequest): Promise<void> {
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
      if (!isSupportedWriteBackResourceType(resourceType)) {
        throw new BadRequestError("Unsupported resource type", undefined, {
          resourceType,
        });
      }
      const metriportOnlyResources = await getMetriportOnlyResourcesFromS3({
        ehr,
        cxId,
        metriportPatientId,
        ehrPatientId,
        resourceType,
        jobId: createResourceDiffBundlesJobId,
      });
      if (metriportOnlyResources.length < 1) {
        await setJobEntryStatus({
          ...entryStatusParams,
          entryStatus: "successful",
        });
        return;
      }
      const resourcesToWriteBack = await getResourcesToWriteBack({
        ehr,
        practiceId,
        resources: metriportOnlyResources,
      });
      try {
        await createOrReplaceBundle({
          ehr,
          cxId,
          metriportPatientId,
          ehrPatientId,
          bundleType: BundleType.RESOURCE_DIFF_WRITE_BACK,
          bundle: createBundleFromResourceList(resourcesToWriteBack),
          resourceType,
          jobId,
        });
      } catch (error) {
        out(
          `writeBackResourceDiffBundles - metriportPatientId ${metriportPatientId} ehrPatientId ${ehrPatientId} resourceType ${resourceType}`
        ).log(`Error creating write back bundle. Cause: ${errorToString(error)}`);
      }
      await writeBackResources({
        ehr,
        tokenId,
        cxId,
        practiceId,
        ehrPatientId,
        resources: resourcesToWriteBack,
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

async function getMetriportOnlyResourcesFromS3({
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
    bundleType: BundleType.RESOURCE_DIFF_METRIPORT_ONLY,
    jobId,
  });
  if (!bundle?.bundle.entry || bundle.bundle.entry.length < 1) return [];
  return bundle.bundle.entry.flatMap(entry => {
    if (!entry.resource) return [];
    return [entry.resource];
  });
}

async function getResourcesToWriteBack({
  ehr,
  practiceId,
  resources,
}: {
  ehr: EhrSource;
  practiceId: string;
  resources: Resource[];
}): Promise<Resource[]> {
  const resourcesToWriteBack: Resource[] = [];
  for (const resource of resources) {
    const writeBackResourceType = getWriteBackResourceType(resource);
    if (!writeBackResourceType) continue;
    const writeBackFilters = await getWriteBackFilters({ ehr, practiceId });
    const shouldWriteBack = filterResource({
      resource,
      resources,
      writeBackResourceType,
      writeBackFilters,
    });
    if (!shouldWriteBack) continue;
    resourcesToWriteBack.push(resource);
  }
  return resourcesToWriteBack;
}

async function getWriteBackFilters({
  ehr,
  practiceId,
}: {
  ehr: EhrSource;
  practiceId: string;
}): Promise<WriteBackFiltersPerResourceType | undefined> {
  const mappingsSchema = ehrCxMappingSecondaryMappingsSchemaMap[ehr];
  if (!mappingsSchema) return undefined;
  const secondaryMappings = await getSecondaryMappings({
    ehr,
    practiceId,
    schema: mappingsSchema,
  });
  if (!secondaryMappings) return undefined;
  return secondaryMappings.writeBackFilters;
}

function getWriteBackResourceType(resource: Resource): WriteBackResourceType | undefined {
  if (resource.resourceType === "Condition") return "condition";
  if (resource.resourceType === "Observation") {
    if (isLab(resource as Observation)) return "lab";
    if (isVital(resource as Observation)) return "vital";
    return undefined;
  }
  throw new BadRequestError("Could not find write back resource type for resource", undefined, {
    resourceType: resource.resourceType,
  });
}

function filterResource({
  resource,
  resources,
  writeBackResourceType,
  writeBackFilters,
}: {
  resource: Resource;
  resources: Resource[];
  writeBackResourceType: WriteBackResourceType;
  writeBackFilters: WriteBackFiltersPerResourceType | undefined;
}): boolean {
  if (!writeBackFilters) return true;
  if (writeBackResourceType === "condition") {
    const condition = resource as Condition;
    if (skipConditionChronicity(condition, writeBackFilters)) return false;
    return true;
  } else if (writeBackResourceType === "lab") {
    const observation = resource as Observation;
    const labObservations = resources.filter(
      r => r.resourceType === "Observation" && isLab(r as Observation)
    ) as Observation[];
    if (skipLabLoinCode(observation, writeBackFilters)) return false;
    if (skipLabDate(observation, writeBackFilters)) return false;
    if (skipLabNonTrending(observation, labObservations, writeBackFilters)) return false;
    return true;
  } else if (writeBackResourceType === "vital") {
    const observation = resource as Observation;
    if (skipVitalDate(observation, writeBackFilters)) return false;
    if (skipVitalLoinCode(observation, writeBackFilters)) return false;
    return true;
  }
  throw new BadRequestError("Could not find write back resource type", undefined, {
    writeBackResourceType,
  });
}

function skipConditionChronicity(
  condition: Condition,
  writeBackFilters: WriteBackFiltersPerResourceType
): boolean {
  const chronicityFilters = writeBackFilters.problems?.chronicityFilters;
  if (chronicityFilters === "all") return false;
  if (isChronicCondition(condition) && chronicityFilters !== "chronic") return true;
  if (!isChronicCondition(condition) && chronicityFilters === "non-chronic") return true;
  return false;
}

function skipLabDate(
  observation: Observation,
  writeBackFilters: WriteBackFiltersPerResourceType
): boolean {
  const relativeDateRange = writeBackFilters?.lab?.relativeDateRange;
  if (!relativeDateRange) return false;
  const observationDate = getObservationObservedDate(observation);
  if (!observationDate) return false;
  let beginDate = buildDayjs();
  if (relativeDateRange.days) {
    beginDate = beginDate.subtract(relativeDateRange.days, "day");
  }
  if (relativeDateRange.months) {
    beginDate = beginDate.subtract(relativeDateRange.months, "month");
  }
  if (relativeDateRange.years) {
    beginDate = beginDate.subtract(relativeDateRange.years, "year");
  }
  return buildDayjs(observationDate).isAfter(beginDate);
}

function skipLabLoinCode(
  observation: Observation,
  writeBackFilters: WriteBackFiltersPerResourceType
): boolean {
  const loincCodes = writeBackFilters?.lab?.loincCodes;
  if (!loincCodes || loincCodes.length < 1) return false;
  const loincCode = getObservationLoincCode(observation);
  if (!loincCode) return false;
  return !loincCodes.includes(loincCode);
}

function skipLabNonTrending(
  observation: Observation,
  labObservations: Observation[],
  writeBackFilters: WriteBackFiltersPerResourceType
): boolean {
  const minCountPerCode = writeBackFilters?.lab?.minCountPerCode;
  if (!minCountPerCode) return false;
  const loincCode = getObservationLoincCode(observation);
  if (!loincCode) return false;
  const count = labObservations.filter(o => getObservationLoincCode(o) === loincCode).length;
  return count >= minCountPerCode;
}

function skipVitalDate(
  observation: Observation,
  writeBackFilters: WriteBackFiltersPerResourceType
): boolean {
  const relativeDateRange = writeBackFilters?.vital?.relativeDateRange;
  if (!relativeDateRange) return false;
  const observationDate = getObservationObservedDate(observation);
  if (!observationDate) return false;
  let beginDate = buildDayjs();
  if (relativeDateRange.days) {
    beginDate = beginDate.subtract(relativeDateRange.days, "day");
  }
  if (relativeDateRange.months) {
    beginDate = beginDate.subtract(relativeDateRange.months, "month");
  }
  if (relativeDateRange.years) {
    beginDate = beginDate.subtract(relativeDateRange.years, "year");
  }
  return buildDayjs(observationDate).isAfter(beginDate);
}

function skipVitalLoinCode(
  observation: Observation,
  writeBackFilters: WriteBackFiltersPerResourceType
): boolean {
  const loincCodes = writeBackFilters?.vital?.loincCodes;
  if (!loincCodes || loincCodes.length < 1) return false;
  const loincCode = getObservationLoincCode(observation);
  if (!loincCode) return false;
  return !loincCodes.includes(loincCode);
}

async function writeBackResources({
  ehr,
  tokenId,
  cxId,
  practiceId,
  ehrPatientId,
  resources,
}: {
  ehr: EhrSource;
  tokenId: string | undefined;
  cxId: string;
  practiceId: string;
  ehrPatientId: string;
  resources: Resource[];
}): Promise<void> {
  const writeBackErrors: { error: unknown; resource: Resource }[] = [];
  await executeAsynchronously(
    resources,
    async resource => {
      try {
        const writeBackResourceType = getWriteBackResourceType(resource);
        if (!writeBackResourceType) return;
        await writeBackResource({
          ehr,
          ...(tokenId && { tokenId }),
          cxId,
          practiceId,
          ehrPatientId,
          resource,
          writeBackResource: writeBackResourceType,
        });
      } catch (error) {
        if (error instanceof BadRequestError || error instanceof NotFoundError) return;
        const resourceToString = JSON.stringify(resource);
        log(`Failed to write back resource ${resourceToString}. Cause: ${errorToString(error)}`);
        writeBackErrors.push({ error, resource });
      }
    },
    {
      numberOfParallelExecutions: parallelRequests,
      delay: delayBetweenRequestBatches.asMilliseconds(),
    }
  );
  if (writeBackErrors.length > 0) {
    const msg = `Failure while writing back some resources @ EHR`;
    capture.message(msg, {
      extra: {
        writeBackArgsCount: resources.length,
        writeBackErrorsCount: writeBackErrors.length,
        errors: writeBackErrors,
        context: "create-resource-diff-bundles.write-back.writeBackMetriportOnlyResources",
      },
    });
  }
}
