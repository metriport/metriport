import {
  Condition,
  DiagnosticReport,
  Medication,
  MedicationStatement,
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
import {
  isCondition,
  isDiagnosticReport,
  isMedicationStatement,
  isObservation,
} from "../../../../fhir/shared";
import { getSecondaryMappings } from "../../../api/get-secondary-mappings";
import { BundleType } from "../../../bundle/bundle-shared";
import { createOrReplaceBundle } from "../../../bundle/command/create-or-replace-bundle";
import { fetchBundle, FetchBundleParams } from "../../../bundle/command/fetch-bundle";
import { getClientTokenInfo } from "../../../command/get-client-token-info";
import { getEhrWriteBackConditionPrimaryCode } from "../../../command/write-back/condition";
import { getEhrGroupedVitals } from "../../../command/write-back/grouped-vitals";
import { writeBackResource, WriteBackResourceType } from "../../../command/write-back/shared";
import { isEhrSourceWithClientCredentials } from "../../../environment";
import {
  ehrCxMappingSecondaryMappingsSchemaMap,
  isEhrSourceWithSecondaryMappings,
} from "../../../mappings";
import {
  getConditionIcd10Code,
  getConditionIcd10Coding,
  getConditionSnomedCode,
  getConditionSnomedCoding,
  getConditionStartDate,
  getDiagnosticReportDate,
  getDiagnosticReportLoincCode,
  getMedicationRxnormCode,
  getMedicationStatementStartDate,
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
  "MedicationStatement",
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
        r => getWriteBackResourceType(r) === "grouped-vitals"
      );
      const keptObservations = await filterObservations({
        observations: groupedVitalsObservations.filter(isObservation),
        writeBackFilters,
      });
      const resourcesToWriteBackFilteredObservations = [...keptObservations, ...restNoObservations];
      const [conditions, restNoConditions] = partition(
        resourcesToWriteBackFilteredObservations,
        r => getWriteBackResourceType(r) === "condition"
      );
      const keptConditions = await filterConditions({
        ehr,
        conditions: conditions.filter(isCondition),
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
        writeBackFilters,
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

function groupObservationsByDiagnosticReport({
  diagnosticReports,
  observations,
}: {
  diagnosticReports: DiagnosticReport[];
  observations: Observation[];
}): { diagnosticReport: DiagnosticReport; observations: Observation[] }[] {
  const groupedResources: {
    diagnosticReport: DiagnosticReport;
    observations: Observation[];
  }[] = [];
  for (const diagnosticReport of diagnosticReports) {
    if (!diagnosticReport.result || diagnosticReport.result.length < 1) {
      groupedResources.push({ diagnosticReport, observations: [] });
      continue;
    }
    const observationsList: Observation[] = [];
    for (const observationReference of diagnosticReport.result) {
      const observation = observations.find(
        observation => `Observation/${observation.id}` === observationReference.reference
      );
      if (!observation || observation.resourceType !== "Observation") continue;
      observationsList.push(observation);
    }
    groupedResources.push({ diagnosticReport, observations: observationsList });
  }
  return groupedResources;
}

function groupMedicationStatementsByMedication({
  medications,
  statements,
}: {
  medications: Medication[];
  statements: MedicationStatement[];
}): { medication: Medication; statements: MedicationStatement[] }[] {
  const groupedResources: {
    medication: Medication;
    statements: MedicationStatement[];
  }[] = [];
  for (const medication of medications) {
    const medicationId = medication.id;
    if (!medicationId) {
      groupedResources.push({ medication, statements: [] });
      continue;
    }
    const statementsList: MedicationStatement[] = [];
    for (const statement of statements) {
      if (!statement.medicationReference || !statement.medicationReference.reference) continue;
      const ref = statement.medicationReference.reference;
      if (ref !== `Medication/${medicationId}`) continue;
      statementsList.push(statement);
    }
    groupedResources.push({ medication, statements: statementsList });
  }
  return groupedResources;
}

async function getWriteBackFilters({
  ehr,
  practiceId,
}: {
  ehr: EhrSource;
  practiceId: string;
}): Promise<WriteBackFiltersPerResourceType | undefined> {
  if (!isEhrSourceWithSecondaryMappings(ehr)) return undefined;
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
    const writeBackResourceType = getWriteBackResourceType(resource);
    if (!writeBackResourceType) continue;
    if (
      resource.resourceType === "DiagnosticReport" &&
      (!resource.result || resource.result.length < 1)
    ) {
      continue;
    }
    const shouldWriteBack = shouldWriteBackResource({
      ehr,
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

function getWriteBackResourceType(resource: Resource): WriteBackResourceType | undefined {
  if (isCondition(resource)) return "condition";
  if (isObservation(resource)) {
    if (isLab(resource)) return "lab";
    if (isVital(resource)) return "grouped-vitals";
    return undefined;
  }
  if (isMedicationStatement(resource)) return "medication-statement";
  if (isDiagnosticReport(resource)) {
    if (isLabPanel(resource)) return "lab-panel";
    return undefined;
  }
  throw new BadRequestError("Could not find write back resource type for resource", undefined, {
    resourceType: resource.resourceType,
  });
}

export function shouldWriteBackResource({
  ehr,
  resource,
  resources,
  writeBackResourceType,
  writeBackFilters,
}: {
  ehr: EhrSource;
  resource: Resource;
  resources: Resource[];
  writeBackResourceType: WriteBackResourceType;
  writeBackFilters: WriteBackFiltersPerResourceType | undefined;
}): boolean {
  if (!writeBackFilters) return true;
  if (writeBackResourceType === "condition") {
    if (writeBackFilters.problem?.disabled) return false;
    if (!isCondition(resource)) return false;
    const condition = resource;
    if (skipConditionChronicity(condition, writeBackFilters)) return false;
    if (skipConditionStringFilters(ehr, condition, writeBackFilters)) return false;
    return true;
  } else if (writeBackResourceType === "lab") {
    if (writeBackFilters.lab?.disabled) return false;
    if (!isObservation(resource)) return false;
    const observation = resource;
    const labObservations = resources.filter(r => isObservation(r) && isLab(r)) as Observation[];
    if (skipLabDate(observation, writeBackFilters)) return false;
    if (skipLabDateAbsolute(observation, writeBackFilters)) return false;
    if (skipLabLoincCode(observation, writeBackFilters)) return false;
    if (skipLabNonTrending(observation, labObservations, writeBackFilters)) return false;
    return true;
  } else if (writeBackResourceType === "lab-panel") {
    if (writeBackFilters.labPanel?.disabled) return false;
    if (!isDiagnosticReport(resource)) return false;
    const diagnosticReport = resource;
    if (skipLabPanelDate(diagnosticReport, writeBackFilters)) return false;
    if (skipLabPanelDateAbsolute(diagnosticReport, writeBackFilters)) return false;
    const normalizedDiagReport = normalizeDiagnosticReportCoding(diagnosticReport);
    const normalizedDiagReportS = resources
      .filter(r => isDiagnosticReport(r) && isLabPanel(r))
      .map(r => normalizeDiagnosticReportCoding(r as DiagnosticReport)) as DiagnosticReport[];
    if (skipLabPanelLoincCode(normalizedDiagReport, writeBackFilters)) return false;
    if (skipLabPanelNonTrending(normalizedDiagReport, normalizedDiagReportS, writeBackFilters)) {
      return false;
    }
    return true;
  } else if (writeBackResourceType === "grouped-vitals") {
    if (writeBackFilters.vital?.disabled) return false;
    if (!isObservation(resource)) return false;
    const observation = resource;
    if (skipVitalDate(observation, writeBackFilters)) return false;
    if (skipVitalLoinCode(observation, writeBackFilters)) return false;
    return true;
  } else if (writeBackResourceType === "medication-statement") {
    if (writeBackFilters.medicationstatement?.disabled) return false;
    if (!isMedicationStatement(resource)) return false;
    const medicationStatement = resource;
    if (skipMedicationStatementDateAbsolute(medicationStatement, writeBackFilters)) return false;
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

export function skipConditionStringFilters(
  ehr: EhrSource,
  condition: Condition,
  writeBackFilters: WriteBackFiltersPerResourceType
): boolean {
  const stringFilters = writeBackFilters.problem?.stringFilters;
  if (!stringFilters) return false;
  const primaryCodeSystem = getEhrWriteBackConditionPrimaryCode(ehr);
  const getCoding =
    primaryCodeSystem === SNOMED_CODE ? getConditionSnomedCoding : getConditionIcd10Coding;
  const coding = getCoding(condition);
  if (!coding || !coding.display) return true;
  if (stringFilters.find(filter => coding.display?.toLowerCase().includes(filter.toLowerCase()))) {
    return false;
  }
  return true;
}

export function skipLabPanelDate(
  diagnosticReport: DiagnosticReport,
  writeBackFilters: WriteBackFiltersPerResourceType,
  startDate?: Date
): boolean {
  const relativeDateRange = writeBackFilters.labPanel?.relativeDateRange;
  if (!relativeDateRange) return false;
  const reportDate = getDiagnosticReportDate(diagnosticReport);
  if (!reportDate) return true;
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
  return buildDayjs(reportDate).isBefore(beginDate);
}

export function skipLabPanelDateAbsolute(
  diagnosticReport: DiagnosticReport,
  writeBackFilters: WriteBackFiltersPerResourceType
): boolean {
  const absoluteDate = writeBackFilters.labPanel?.absoluteDate;
  if (!absoluteDate) return false;
  const reportDate = getDiagnosticReportDate(diagnosticReport);
  if (!reportDate) return true;
  return buildDayjs(reportDate).isBefore(buildDayjs(absoluteDate));
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

export function skipLabDateAbsolute(
  observation: Observation,
  writeBackFilters: WriteBackFiltersPerResourceType
): boolean {
  const absoluteDate = writeBackFilters.lab?.absoluteDate;
  if (!absoluteDate) return false;
  const observationDate = getObservationObservedDate(observation);
  if (!observationDate) return true;
  return buildDayjs(observationDate).isBefore(buildDayjs(absoluteDate));
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

export function skipMedicationRxnormCode(
  medication: Medication,
  writeBackFilters: WriteBackFiltersPerResourceType
): boolean {
  const rxnormCodes = writeBackFilters?.medicationstatement?.rxnormCodes;
  if (!rxnormCodes) return false;
  const rxnormCode = getMedicationRxnormCode(medication);
  if (!rxnormCode) return true;
  return !rxnormCodes.includes(rxnormCode);
}

export function skipMedicationStatementDateAbsolute(
  medicationStatement: MedicationStatement,
  writeBackFilters: WriteBackFiltersPerResourceType
): boolean {
  const absoluteDate = writeBackFilters.medicationstatement?.absoluteDate;
  if (!absoluteDate) return false;
  const startDate = getMedicationStatementStartDate(medicationStatement);
  if (!startDate) return true;
  return buildDayjs(startDate).isBefore(buildDayjs(absoluteDate));
}

async function getSecondaryResourcesToWriteBackMap({
  cxId,
  metriportPatientId,
  resources,
  resourceType,
  writeBackFilters,
}: {
  cxId: string;
  metriportPatientId: string;
  resources: Resource[];
  resourceType: string;
  writeBackFilters: WriteBackFiltersPerResourceType | undefined;
}): Promise<Record<string, Resource[]>> {
  if (resourceType !== "DiagnosticReport" && resourceType !== "MedicationStatement") return {};
  if (resourceType === "DiagnosticReport") {
    const observations = await getMetriportResourcesFromS3({
      cxId,
      patientId: metriportPatientId,
      resourceType: "Observation",
    });
    const groupedObservations = groupObservationsByDiagnosticReport({
      diagnosticReports: resources as DiagnosticReport[],
      observations: observations as Observation[],
    });
    return groupedObservations.reduce((acc, { diagnosticReport, observations }) => {
      if (!diagnosticReport.id) return acc;
      acc[diagnosticReport.id] = observations;
      return acc;
    }, {} as Record<string, Resource[]>);
  } else {
    const medications = await getMetriportResourcesFromS3({
      cxId,
      patientId: metriportPatientId,
      resourceType: "Medication",
    });
    const filteredMedications = medications.filter(medication => {
      if (!writeBackFilters) return true;
      if (skipMedicationRxnormCode(medication as Medication, writeBackFilters)) {
        return false;
      }
      return true;
    });
    const groupedMedicationStatements = groupMedicationStatementsByMedication({
      medications: filteredMedications as Medication[],
      statements: resources as MedicationStatement[],
    });
    return groupedMedicationStatements.reduce((acc, { medication, statements }) => {
      for (const statement of statements) {
        if (!statement.id) continue;
        acc[statement.id] = [medication];
      }
      return acc;
    }, {} as Record<string, Resource[]>);
  }
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
    r => getWriteBackResourceType(r) === "grouped-vitals"
  );
  const groupedVitals = getEhrGroupedVitals({
    ehr,
    vitals: groupedVitalsObservations as Observation[],
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
        const writeBackResourceType = getWriteBackResourceType(resource);
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
