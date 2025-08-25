import {
  Condition,
  DiagnosticReport,
  Observation,
  Resource,
  ResourceType,
} from "@medplum/fhirtypes";
import {
  BadRequestError,
  createBundleFromResourceList,
  errorToString,
  JwtTokenInfo,
  NotFoundError,
  sleep,
} from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { WriteBackFiltersPerResourceType } from "@metriport/shared/interface/external/ehr/shared";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";
import { isLoincCoding, SNOMED_CODE } from "@metriport/shared/medical";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { partition } from "lodash";
import { getConsolidatedFile } from "../../../../../command/consolidated/consolidated-get";
import { setJobEntryStatus } from "../../../../../command/job/patient/api/set-entry-status";
import { executeAsynchronously } from "../../../../../util/concurrency";
import { log, out } from "../../../../../util/log";
import { capture } from "../../../../../util/notifications";
import { isCondition, isDiagnosticReport, isObservation } from "../../../../fhir/shared";
import { getSecondaryMappings } from "../../../api/get-secondary-mappings";
import { BundleType } from "../../../bundle/bundle-shared";
import { createOrReplaceBundle } from "../../../bundle/command/create-or-replace-bundle";
import { fetchBundle, FetchBundleParams } from "../../../bundle/command/fetch-bundle";
import { getClientTokenInfo } from "../../../command/get-client-token-info";
import { getEhrWriteBackConditionPrimaryCode } from "../../../command/write-back/condition";
import {
  GroupedVitalsByDate,
  isWriteBackGroupedVitalsEhr,
} from "../../../command/write-back/grouped-vitals";
import { writeBackResource, WriteBackResourceType } from "../../../command/write-back/shared";
import { isEhrSourceWithClientCredentials } from "../../../environment";
import { ehrCxMappingSecondaryMappingsSchemaMap } from "../../../mappings";
import {
  formatDate,
  getConditionIcd10Code,
  getConditionSnomedCode,
  getConditionStartDate,
  getDiagnosticReportDate,
  getDiagnosticReportLoincCode,
  getObservationLoincCode,
  getObservationObservedDate,
  isChronicCondition,
  isLab,
  isLabPanel,
  isVital,
} from "../../../shared";
import {
  EhrWriteBackResourceDiffBundlesHandler,
  WriteBackResourceDiffBundlesRequest,
} from "./ehr-write-back-resource-diff-bundles";

dayjs.extend(duration);

const parallelRequests = 2;
const minJitter = dayjs.duration(0, "seconds");
const maxJitter = dayjs.duration(5, "seconds");

const displayToLoincCodeMap: Record<string, string> = {
  "comprehensive metabolic panel": "24322-0",
  "cbc with differential": "57021-8",
  "basic metabolic panel": "51990-0",
  "basic metabolic panel (c7)": "51990-0",
  "glycohemoglobin (a1c)": "4548-4",
  "hemoglobin & hematocrit": "4548-4",
  "hemoglobin and hematocrit panel - blood": "4548-4",
  "lipase [enzymatic activity/volume] in serum or plasma": "24331-1",
  "thyroxine (t4) free [mass/volume] in serum or plasma": "3016-3",
  "thyroid stimulating hormone (tsh)": "3016-3",
  "tsh w/ reflex ft4": "3016-3",
};

const supportedWriteBackResourceTypes: ResourceType[] = [
  "Condition",
  "Observation",
  "DiagnosticReport",
];
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
      const writeBackFilters = await getWriteBackFilters({ ehr, practiceId });
      const resourcesToWriteBack = getResourcesToWriteBack({
        ehr,
        resources: metriportOnlyResources,
        writeBackFilters,
      });
      const [groupedVitalsObservations, restNoObservations] = partition(
        resourcesToWriteBack,
        r => getWriteBackResourceType(ehr, r) === "grouped-vitals"
      );
      const keptObservations = await filterObservations({
        observations: groupedVitalsObservations as Observation[],
        writeBackFilters,
      });
      const resourcesToWriteBackFilteredObservations = [...keptObservations, ...restNoObservations];
      const [conditions, restNoConditions] = partition(
        resourcesToWriteBackFilteredObservations,
        r => getWriteBackResourceType(ehr, r) === "condition"
      );
      const keptConditions = await filterConditions({
        ehr,
        conditions: conditions as Condition[],
        writeBackFilters,
      });
      const resourcesToWriteBackFilteredConditionsAndObservations = [
        ...keptConditions,
        ...restNoConditions,
      ];
      const secondaryResourcesToWriteBackMap = await getSecondaryResourcesToWriteBackMap({
        cxId,
        metriportPatientId,
        resources: resourcesToWriteBackFilteredConditionsAndObservations,
        resourceType,
      });
      try {
        await createOrReplaceBundle({
          ehr,
          cxId,
          metriportPatientId,
          ehrPatientId,
          bundleType: BundleType.RESOURCE_DIFF_WRITE_BACK,
          bundle: createBundleFromResourceList([
            ...resourcesToWriteBackFilteredConditionsAndObservations,
            ...Object.values(secondaryResourcesToWriteBackMap).flat(),
          ]),
          resourceType,
          jobId,
          mixedResourceTypes: true,
        });
      } catch (error) {
        out(
          `writeBackResourceDiffBundles - metriportPatientId ${metriportPatientId} ehrPatientId ${ehrPatientId} resourceType ${resourceType}`
        ).log(`Error creating write back bundle. Cause: ${errorToString(error)}`);
      }
      await writeBackResources({
        ehr,
        cxId,
        practiceId,
        ehrPatientId,
        resources: resourcesToWriteBackFilteredConditionsAndObservations,
        secondaryResourcesMap: secondaryResourcesToWriteBackMap,
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
  const resources = bundle.bundle.entry.flatMap(entry => {
    if (!entry.resource) return [];
    return [entry.resource];
  });
  return resources;
}

async function getMetriportResourcesFromS3({
  cxId,
  patientId,
  resourceType,
}: {
  cxId: string;
  patientId: string;
  resourceType: string;
}): Promise<Resource[]> {
  const consolidated = await getConsolidatedFile({ cxId, patientId });
  if (!consolidated?.bundle?.entry || consolidated.bundle.entry.length < 1) return [];
  const resources = consolidated.bundle.entry.filter(
    entry => entry.resource?.resourceType === resourceType
  );
  if (resources.length < 1) return [];
  return resources.flatMap(entry => {
    if (!entry.resource) return [];
    return [entry.resource];
  });
}

async function hydrateDiagnosticReports({
  diagnosticReports,
  observations,
}: {
  diagnosticReports: DiagnosticReport[];
  observations: Observation[];
}): Promise<{ diagnosticReport: DiagnosticReport; observations: Observation[] }[]> {
  const hydratedMetriportOnlyResources: {
    diagnosticReport: DiagnosticReport;
    observations: Observation[];
  }[] = [];
  for (const diagnosticReport of diagnosticReports) {
    if (!diagnosticReport.result || diagnosticReport.result.length < 1) {
      hydratedMetriportOnlyResources.push({ diagnosticReport, observations: [] });
      continue;
    }
    const hydratedObservations: Observation[] = [];
    for (const observationReference of diagnosticReport.result) {
      const observation = observations.find(
        observation => `Observation/${observation.id}` === observationReference.reference
      );
      if (!observation || observation.resourceType !== "Observation") continue;
      hydratedObservations.push(observation);
    }
    hydratedMetriportOnlyResources.push({ diagnosticReport, observations: hydratedObservations });
  }
  return hydratedMetriportOnlyResources;
}

async function getWriteBackFilters({
  ehr,
  practiceId,
}: {
  ehr: EhrSource;
  practiceId: string;
}): Promise<WriteBackFiltersPerResourceType | undefined> {
  const mappingsSchema = ehrCxMappingSecondaryMappingsSchemaMap[ehr];
  if (!mappingsSchema) {
    throw new BadRequestError("No mappings schema found for EHR", undefined, {
      ehr,
    });
  }
  const secondaryMappings = await getSecondaryMappings({
    ehr,
    practiceId,
    schema: mappingsSchema,
  });
  if (!secondaryMappings) {
    throw new BadRequestError("No secondary mappings found for EHR", undefined, {
      ehr,
      practiceId,
    });
  }
  if (!secondaryMappings.writeBackEnabled) {
    throw new BadRequestError("Write back is not enabled for EHR", undefined, {
      ehr,
      practiceId,
    });
  }
  return secondaryMappings.writeBackFilters;
}

function getResourcesToWriteBack({
  ehr,
  resources,
  writeBackFilters,
}: {
  ehr: EhrSource;
  resources: Resource[];
  writeBackFilters: WriteBackFiltersPerResourceType | undefined;
}): Resource[] {
  const resourcesToWriteBack: Resource[] = [];
  for (const resource of resources) {
    const writeBackResourceType = getWriteBackResourceType(ehr, resource);
    if (!writeBackResourceType) continue;
    if (
      resource.resourceType === "DiagnosticReport" &&
      (!resource.result || resource.result.length < 1)
    ) {
      continue;
    }
    const shouldWriteBack = shouldWriteBackResource({
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

function getWriteBackResourceType(
  ehr: EhrSource,
  resource: Resource
): WriteBackResourceType | undefined {
  if (isCondition(resource)) return "condition";
  if (isObservation(resource)) {
    if (isLab(resource)) return "lab";
    if (isVital(resource) && isWriteBackGroupedVitalsEhr(ehr)) return "grouped-vitals";
    return undefined;
  }
  if (isDiagnosticReport(resource)) {
    if (isLabPanel(resource)) return "lab-panel";
    return undefined;
  }
  throw new BadRequestError("Could not find write back resource type for resource", undefined, {
    resourceType: resource.resourceType,
  });
}

export function shouldWriteBackResource({
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
    if (writeBackFilters.problem?.disabled) return false;
    const condition = resource as Condition;
    if (skipConditionChronicity(condition, writeBackFilters)) return false;
    return true;
  } else if (writeBackResourceType === "lab") {
    if (writeBackFilters.lab?.disabled) return false;
    const observation = resource as Observation;
    const labObservations = resources.filter(
      r => r.resourceType === "Observation" && isLab(r)
    ) as Observation[];
    if (skipLabDate(observation, writeBackFilters)) return false;
    if (skipLabLoincCode(observation, writeBackFilters)) return false;
    if (skipLabNonTrending(observation, labObservations, writeBackFilters)) return false;
    return true;
  } else if (writeBackResourceType === "lab-panel") {
    if (writeBackFilters.labPanel?.disabled) return false;
    const diagnosticReport = resource as DiagnosticReport;
    const diagnosticReports = resources
      .filter(r => r.resourceType === "DiagnosticReport" && isLabPanel(r))
      .map(r => normalizeDiagnosticReportCoding(r as DiagnosticReport)) as DiagnosticReport[];
    if (skipLabPanelDate(diagnosticReport, writeBackFilters)) return false;
    const normalizedDiagReport = normalizeDiagnosticReportCoding(diagnosticReport);
    if (skipLabPanelLoincCode(normalizedDiagReport, writeBackFilters)) return false;
    if (skipLabPanelNonTrending(normalizedDiagReport, diagnosticReports, writeBackFilters)) {
      return false;
    }
    return true;
  } else if (writeBackResourceType === "grouped-vitals") {
    if (writeBackFilters.vital?.disabled) return false;
    const observation = resource as Observation;
    if (skipVitalDate(observation, writeBackFilters)) return false;
    if (skipVitalLoinCode(observation, writeBackFilters)) return false;
    return true;
  }
  throw new BadRequestError("Could not find write back resource type", undefined, {
    writeBackResourceType,
  });
}

export function skipConditionChronicity(
  condition: Condition,
  writeBackFilters: WriteBackFiltersPerResourceType
): boolean {
  const chronicityFilter = writeBackFilters.problem?.chronicityFilter;
  if (!chronicityFilter || chronicityFilter === "all") return false;
  if (isChronicCondition(condition) && chronicityFilter === "chronic") return false;
  if (!isChronicCondition(condition) && chronicityFilter === "non-chronic") return false;
  return true;
}

export function skipLabPanelDate(
  diagnosticReport: DiagnosticReport,
  writeBackFilters: WriteBackFiltersPerResourceType,
  startDate?: Date
): boolean {
  const relativeDateRange = writeBackFilters.labPanel?.relativeDateRange;
  if (!relativeDateRange) return false;
  const observationDate = getDiagnosticReportDate(diagnosticReport);
  if (!observationDate) return true;
  let beginDate = startDate ? buildDayjs(startDate) : buildDayjs();
  if (relativeDateRange.days) {
    beginDate = beginDate.subtract(relativeDateRange.days, "day");
  }
  if (relativeDateRange.months) {
    beginDate = beginDate.subtract(relativeDateRange.months, "month");
  }
  if (relativeDateRange.years) {
    beginDate = beginDate.subtract(relativeDateRange.years, "year");
  }
  return buildDayjs(observationDate).isBefore(beginDate);
}

export function normalizeDiagnosticReportCoding(
  diagnosticReport: DiagnosticReport
): DiagnosticReport {
  const code = diagnosticReport.code;

  let foundLoincCode: string | undefined;
  const matchingCoding = code?.coding?.find(c => {
    if (isLoincCoding(c)) return false;
    const display = c.display?.trim().toLowerCase() ?? "";
    foundLoincCode = displayToLoincCodeMap[display];
    return foundLoincCode;
  });

  if (!matchingCoding?.display || !foundLoincCode) return diagnosticReport;

  const newLoincCoding = {
    code: foundLoincCode,
    display: matchingCoding.display,
    system: "http://loinc.org",
  };

  return {
    ...diagnosticReport,
    code: {
      ...diagnosticReport.code,
      coding: [newLoincCoding],
    },
  };
}

export function skipLabPanelLoincCode(
  diagnosticReport: DiagnosticReport,
  writeBackFilters: WriteBackFiltersPerResourceType
): boolean {
  const loincCodes = writeBackFilters.labPanel?.loincCodes;
  if (!loincCodes) return false;
  const loincCode = getDiagnosticReportLoincCode(diagnosticReport);
  if (!loincCode) return true;
  return !loincCodes.includes(loincCode);
}

export function skipLabPanelNonTrending(
  diagnosticReport: DiagnosticReport,
  diagnosticReports: DiagnosticReport[],
  writeBackFilters: WriteBackFiltersPerResourceType
): boolean {
  const minCountPerCode = writeBackFilters.labPanel?.minCountPerCode;
  if (!minCountPerCode) return false;
  const loincCode = getDiagnosticReportLoincCode(diagnosticReport);
  if (!loincCode) return true;
  const count = diagnosticReports.filter(o => getDiagnosticReportLoincCode(o) === loincCode).length;
  return count < minCountPerCode;
}

export function skipLabDate(
  observation: Observation,
  writeBackFilters: WriteBackFiltersPerResourceType,
  startDate?: Date
): boolean {
  const relativeDateRange = writeBackFilters.lab?.relativeDateRange;
  if (!relativeDateRange) return false;
  const observationDate = getObservationObservedDate(observation);
  if (!observationDate) return true;
  let beginDate = startDate ? buildDayjs(startDate) : buildDayjs();
  if (relativeDateRange.days) {
    beginDate = beginDate.subtract(relativeDateRange.days, "day");
  }
  if (relativeDateRange.months) {
    beginDate = beginDate.subtract(relativeDateRange.months, "month");
  }
  if (relativeDateRange.years) {
    beginDate = beginDate.subtract(relativeDateRange.years, "year");
  }
  return buildDayjs(observationDate).isBefore(beginDate);
}

export function skipLabLoincCode(
  observation: Observation,
  writeBackFilters: WriteBackFiltersPerResourceType
): boolean {
  const loincCodes = writeBackFilters.lab?.loincCodes;
  if (!loincCodes) return false;
  const loincCode = getObservationLoincCode(observation);
  if (!loincCode) return true;
  return !loincCodes.includes(loincCode);
}

export function skipLabNonTrending(
  observation: Observation,
  labObservations: Observation[],
  writeBackFilters: WriteBackFiltersPerResourceType
): boolean {
  const minCountPerCode = writeBackFilters.lab?.minCountPerCode;
  if (!minCountPerCode) return false;
  const loincCode = getObservationLoincCode(observation);
  if (!loincCode) return true;
  const count = labObservations.filter(o => getObservationLoincCode(o) === loincCode).length;
  return count < minCountPerCode;
}

export function skipVitalDate(
  observation: Observation,
  writeBackFilters: WriteBackFiltersPerResourceType,
  startDate?: Date
): boolean {
  const relativeDateRange = writeBackFilters?.vital?.relativeDateRange;
  if (!relativeDateRange) return false;
  const observationDate = getObservationObservedDate(observation);
  if (!observationDate) return true;
  let beginDate = startDate ? buildDayjs(startDate) : buildDayjs();
  if (relativeDateRange.days) {
    beginDate = beginDate.subtract(relativeDateRange.days, "day");
  }
  if (relativeDateRange.months) {
    beginDate = beginDate.subtract(relativeDateRange.months, "month");
  }
  if (relativeDateRange.years) {
    beginDate = beginDate.subtract(relativeDateRange.years, "year");
  }
  return buildDayjs(observationDate).isBefore(beginDate);
}

export function skipVitalLoinCode(
  observation: Observation,
  writeBackFilters: WriteBackFiltersPerResourceType
): boolean {
  const loincCodes = writeBackFilters?.vital?.loincCodes;
  if (!loincCodes) return false;
  const loincCode = getObservationLoincCode(observation);
  if (!loincCode) return true;
  return !loincCodes.includes(loincCode);
}

async function getSecondaryResourcesToWriteBackMap({
  cxId,
  metriportPatientId,
  resources,
  resourceType,
}: {
  cxId: string;
  metriportPatientId: string;
  resources: Resource[];
  resourceType: string;
}): Promise<Record<string, Resource[]>> {
  if (resourceType !== "DiagnosticReport") return {};
  const observations = await getMetriportResourcesFromS3({
    cxId,
    patientId: metriportPatientId,
    resourceType: "Observation",
  });
  const hydratedDiagnosticReports = await hydrateDiagnosticReports({
    diagnosticReports: resources as DiagnosticReport[],
    observations: observations as Observation[],
  });
  return hydratedDiagnosticReports.reduce((acc, { diagnosticReport, observations }) => {
    if (!diagnosticReport.id) return acc;
    acc[diagnosticReport.id] = observations;
    return acc;
  }, {} as Record<string, Resource[]>);
}

async function writeBackResources({
  ehr,
  cxId,
  practiceId,
  ehrPatientId,
  resources,
  secondaryResourcesMap,
}: {
  ehr: EhrSource;
  cxId: string;
  practiceId: string;
  ehrPatientId: string;
  resources: Resource[];
  secondaryResourcesMap: Record<string, Resource[]>;
}): Promise<void> {
  let sharedClientTokenInfo: JwtTokenInfo | undefined;
  if (isEhrSourceWithClientCredentials(ehr)) {
    sharedClientTokenInfo = await getClientTokenInfo({
      ehr,
      cxId,
      practiceId,
    });
  }
  const writeBackErrors: { error: unknown; resource: string }[] = [];
  const [groupedVitalsObservations, rest] = partition(
    resources,
    r => getWriteBackResourceType(ehr, r) === "grouped-vitals"
  );
  const groupedVitals = await groupVitalsByDate({
    observations: groupedVitalsObservations as Observation[],
  });
  await executeAsynchronously(
    groupedVitals,
    async resource => {
      try {
        await writeBackResource({
          ehr,
          ...(sharedClientTokenInfo ? { tokenInfo: sharedClientTokenInfo } : {}),
          cxId,
          practiceId,
          ehrPatientId,
          primaryResourceOrResources: resource,
          writeBackResource: "grouped-vitals",
        });
      } catch (error) {
        if (error instanceof BadRequestError || error instanceof NotFoundError) return;
        const resourceToString = JSON.stringify(resource);
        log(`Failed to write back resource ${resourceToString}. Cause: ${errorToString(error)}`);
        writeBackErrors.push({ error, resource: resourceToString });
      }
    },
    {
      numberOfParallelExecutions: parallelRequests,
      maxJitterMillis: maxJitter.asMilliseconds(),
      minJitterMillis: minJitter.asMilliseconds(),
    }
  );
  await executeAsynchronously(
    rest,
    async resource => {
      try {
        const writeBackResourceType = getWriteBackResourceType(ehr, resource);
        if (!writeBackResourceType) return;
        const secondaryResources = resource.id ? secondaryResourcesMap[resource.id] : undefined;
        await writeBackResource({
          ehr,
          ...(sharedClientTokenInfo ? { tokenInfo: sharedClientTokenInfo } : {}),
          cxId,
          practiceId,
          ehrPatientId,
          primaryResourceOrResources: resource,
          ...(secondaryResources && { secondaryResourceOrResources: secondaryResources }),
          writeBackResource: writeBackResourceType,
        });
      } catch (error) {
        if (error instanceof BadRequestError || error instanceof NotFoundError) return;
        const resourceToString = JSON.stringify(resource);
        log(`Failed to write back resource ${resourceToString}. Cause: ${errorToString(error)}`);
        writeBackErrors.push({ error, resource: resourceToString });
      }
    },
    {
      numberOfParallelExecutions: parallelRequests,
      maxJitterMillis: maxJitter.asMilliseconds(),
      minJitterMillis: minJitter.asMilliseconds(),
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

async function filterConditions({
  ehr,
  conditions,
  writeBackFilters,
}: {
  ehr: EhrSource;
  conditions: Condition[];
  writeBackFilters: WriteBackFiltersPerResourceType | undefined;
}): Promise<Condition[]> {
  if (conditions.length < 1) return [];
  if (writeBackFilters?.problem?.latestOnly === undefined || !writeBackFilters.problem.latestOnly) {
    return conditions;
  }
  const primaryCodeSystem = getEhrWriteBackConditionPrimaryCode(ehr);
  const getCode =
    primaryCodeSystem === SNOMED_CODE ? getConditionSnomedCode : getConditionIcd10Code;
  return Object.values(
    conditions.reduce<Record<string, Condition>>((acc, condition) => {
      const code = getCode(condition);
      if (!code) return acc;
      const conditionDate = getConditionStartDate(condition);
      if (!conditionDate) return acc;
      const current = acc[code];
      if (!current) {
        acc[code] = condition;
      } else {
        const currentDate = getConditionStartDate(current);
        if (!currentDate) return acc;
        if (buildDayjs(conditionDate).isAfter(buildDayjs(currentDate))) {
          acc[code] = condition;
        }
      }
      return acc;
    }, {})
  );
}

async function filterObservations({
  observations,
  writeBackFilters,
}: {
  observations: Observation[];
  writeBackFilters: WriteBackFiltersPerResourceType | undefined;
}): Promise<Observation[]> {
  if (observations.length < 1) return [];
  if (writeBackFilters?.vital?.latestOnly === undefined || !writeBackFilters.vital.latestOnly) {
    return observations;
  }
  return Object.values(
    observations.reduce<Record<string, Observation>>((acc, observation) => {
      const loincCode = getObservationLoincCode(observation);
      if (!loincCode) return acc;
      const observationDate = getObservationObservedDate(observation);
      if (!observationDate) return acc;
      const current = acc[loincCode];
      if (!current) {
        acc[loincCode] = observation;
      } else {
        const currentDate = getObservationObservedDate(current);
        if (!currentDate) return acc;
        if (buildDayjs(observationDate).isAfter(buildDayjs(currentDate))) {
          acc[loincCode] = observation;
        }
      }
      return acc;
    }, {})
  );
}

async function groupVitalsByDate({
  observations,
}: {
  observations: Observation[];
}): Promise<GroupedVitalsByDate[]> {
  const groupedVitals: Record<string, Observation[]> = observations.reduce((acc, observation) => {
    const chartDate = getObservationObservedDate(observation);
    if (!chartDate) return acc;
    const chartDateString = formatDate(chartDate, "YYYY-MM-DD");
    if (!chartDateString) return acc;
    const existingVital = acc[chartDateString];
    if (!existingVital) {
      acc[chartDateString] = [observation];
    } else {
      existingVital.push(observation);
    }
    return acc;
  }, {} as Record<string, Observation[]>);
  return Object.entries(groupedVitals).map(([chartDate, observations]) => [
    buildDayjs(chartDate).toDate(),
    observations,
  ]);
}
