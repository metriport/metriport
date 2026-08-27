import {
  Composition,
  DiagnosticReport,
  DocumentReference,
  Encounter,
  Extension,
} from "@medplum/fhirtypes";
import { getConsolidatedFile } from "@metriport/core/command/consolidated/consolidated-get";
import { DISCHARGE_DISPOSITION_SYSTEM } from "@metriport/core/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/adt/mappings";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { isDocIdExtension } from "@metriport/core/external/fhir/shared/extensions/doc-id-extension";
import {
  findCompositionResources,
  findDiagnosticReportResources,
  findDocumentReferenceResources,
  findEncounterResources,
} from "@metriport/core/external/fhir/shared/index";
import { capture } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import { XML_FILE_EXTENSION } from "@metriport/core/util/mime";
import { buildDayjs } from "@metriport/shared/common/date";
import { JobEntryStatus } from "@metriport/shared/domain/job/types";
import {
  defaultDischargeRequeryAttempts,
  DischargeData,
  dischargeRequeryRuntimeDataSchema,
  parseDischargeRequeryJob,
} from "@metriport/shared/domain/patient/patient-monitoring/discharge-requery";
import { base64ToString } from "@metriport/shared/util/base64";
import dayjs from "dayjs";
import { getPatientJobs } from "../../../../job/patient/get";
import { completePatientJob } from "../../../../job/patient/status/complete";
import { failPatientJob } from "../../../../job/patient/status/fail";
import { updatePatientJobRuntimeData } from "../../../../job/patient/update/update-runtime-data";
import { updateTcmEncounter } from "../../../tcm-encounter/update-tcm-encounter";
import { getPatientOrFail } from "../../get-patient";
import { createDischargeRequeryJob, dischargeRequeryJobType } from "./create";

// Ordered by priority (highest bucket first). We iterate and return on first match,
// so higher priority terms must come first.
const DISCHARGE_SUMMARY_SEARCH_TERMS: { term: string; bucket: number }[] = [
  { term: "discharge summary", bucket: 40 },
  { term: "dischargesummary", bucket: 30 },
  { term: "discharge instruction", bucket: 20 },
  { term: "dischargeinstruction", bucket: 10 },
];

// Ordered by priority (highest bucket first). We iterate and return on first match,
// so higher priority codes must come first.
const DISCHARGE_SUMMARY_CODES: { code: string; bucket: number }[] = [
  { code: "18842-5", bucket: 40 }, // Discharge summary (LOINC)
  { code: "8653-8", bucket: 20 }, // Discharge instructions (LOINC)
];

// LOINC codes for Discharge Instructions in DocumentReference type/category
const DOCUMENT_REFERENCE_DISCHARGE_CODES: { code: string; bucket: number }[] = [
  { code: "74213-0", bucket: 20 }, // Discharge Instructions (type.coding)
  { code: "72170-4", bucket: 20 }, // Discharge Instructions (category.coding)
];

const DISCHARGE_SUMMARY_SEARCH_TERM_NO_MATCH_VALUE = -1;

/**
 * If we do not find a Diagnostic report or a document reference
 * we use the encounter with the discharge disposition to score the discharge summary.
 * This is usually not very accurate, so we will rate it very low.
 */
const DISCHARGE_DISPOSITION_SCORE = 5;

// Composition scores based on encounter count. Higher score = better (fewer encounters).
const COMPOSITION_SCORES: { minEncounters: number; maxEncounters: number; bucket: number }[] = [
  { minEncounters: 1, maxEncounters: 1, bucket: 6 },
  { minEncounters: 2, maxEncounters: 4, bucket: 3 },
];

const DISCHARGE_SUMMARY_SCORE_THRESHOLD =
  DISCHARGE_SUMMARY_SEARCH_TERMS[0].bucket + COMPOSITION_SCORES[0].bucket;

/** Default value to indicate no encounters found in a Composition. */
const DEFAULT_NO_ENCOUNTERS_FOUND_VALUE = Infinity;

const TIME_TO_ADD_TO_DISCHARGE_DATE = dayjs.duration(6, "hours");
const HIGHEST_TEMPORAL_SCORE = 2;

type ScoredDocument = {
  document: DiagnosticReport | DocumentReference;
  score: number;
  xmlFilePath: string;
};

type DischargeAssociationSuccess = {
  discharge: DischargeData;
  status: "completed";
  reason: string;
  encounterId: string;
  dischargeSummaryFilePath: string;
};

type DischargeAssociationProcessing = {
  discharge: DischargeData;
  status: "processing";
  reason: string;
};

type DischargeAssociationRequery = DischargeAssociationProcessing;

/**
 * Finishes the discharge requery job.
 *
 * // TODO: ENG-536 - Update the exit condition to depend on finding the discharge summary.
 * If the data pipeline was successful, we will decrement the remaining attempts.
 *  - The existing processing job will be set to completed.
 *  - If the remaining attempts are greater than 0, we will create a new discharge requery job.
 *  - Otherwise, discharge requery is complete, and no new job will be created.
 *
 * If the data pipeline failed, we will retry with the same number of remaining attempts.
 *
 * @param cxId - The CX ID.
 * @param patientId - The patient ID.
 * @param requestId - The data pipeline request ID.
 * @param pipelineStatus - The status of the data pipeline query.
 */
export async function finishDischargeRequery({
  cxId,
  patientId,
  requestId: pipelineRequestId,
  pipelineStatus,
}: {
  cxId: string;
  patientId: string;
  requestId: string;
  pipelineStatus: JobEntryStatus;
}): Promise<void> {
  const { log } = out(`finishDischargeRequery - cx ${cxId}, pt ${patientId}`);

  const processingJobs = await getPatientJobs({
    cxId,
    patientId,
    jobType: dischargeRequeryJobType,
    status: "processing",
  });

  log(`All processing discharge requery jobs: ${JSON.stringify(processingJobs)}`);

  if (processingJobs.length < 1) return;

  const targetJobs = processingJobs.filter(job => {
    const runtimeData = dischargeRequeryRuntimeDataSchema.parse(job.runtimeData);
    return runtimeData?.documentQueryRequestId === pipelineRequestId;
  });

  log(`Target jobs: ${JSON.stringify(targetJobs)}`);
  if (targetJobs.length < 1) {
    const msg = `No target discharge requery job found`;
    log(`Unexpected state: ${msg} for requestId ${pipelineRequestId}`);
    capture.message(msg, {
      extra: {
        cxId,
        patientId,
        jobType: dischargeRequeryJobType,
        pipelineRequestId,
      },
      level: "warning",
    });
    return;
  }

  const [targetJob, ...jobsToFail] = targetJobs;

  if (jobsToFail.length > 0) {
    const msg = `Found an unexpected number of discharge requery jobs`;
    log(
      `Unexpected state: ${msg} for requestId ${pipelineRequestId}, expected 1, found ${targetJobs.length}`
    );
    capture.message(msg, {
      extra: {
        patientId,
        cxId,
        jobType: dischargeRequeryJobType,
        pipelineRequestId,
      },
      level: "warning",
    });

    await Promise.all(
      jobsToFail.map(job =>
        failPatientJob({
          jobId: job.id,
          cxId,
          reason: "Unexpected number of processing discharge requery jobs",
        })
      )
    );
  }

  const job = await completePatientJob({
    jobId: targetJob.id,
    cxId,
  });

  const dischargeRequeryJob = parseDischargeRequeryJob(job);

  const { completed, processing } = await processDischargeSummaryAssociation({
    dischargeData: dischargeRequeryJob.paramsOps.dischargeData,
    cxId,
    patientId,
  });

  await updateTcmEncountersWithDischargeSummaryPaths(completed, cxId, patientId);

  const remainingAttempts =
    pipelineStatus === "successful"
      ? dischargeRequeryJob.paramsOps.remainingAttempts - 1
      : dischargeRequeryJob.paramsOps.remainingAttempts;

  const stillProcessing = remainingAttempts > 0 && processing.length > 0;

  if (pipelineStatus === "successful") {
    const patient = await getPatientOrFail({ cxId, id: patientId });
    const dqProgress = patient.data.documentQueryProgress;
    if (dqProgress) {
      const downloadCount = dqProgress.download?.total;
      const convertCount = dqProgress.convert?.total;

      await updatePatientJobRuntimeData({
        jobId: targetJob.id,
        cxId,
        data: {
          ...dischargeRequeryJob.runtimeData,
          downloadCount,
          convertCount,
          metGoals: completed,
          [stillProcessing ? "processing" : "failed"]: processing,
        },
      });

      analytics({
        event: EventTypes.dischargeRequery,
        distinctId: cxId,
        properties: {
          patientId,
          requestId: dqProgress.requestId,
          downloadCount,
          convertCount,
          remainingAttempts,
        },
      });
    }
  }

  if (stillProcessing) {
    await createDischargeRequeryJob({
      patientId,
      cxId,
      remainingAttempts,
      dischargeData: processing.map(p => p.discharge),
    });
    return;
  }

  log(
    `Discharge requery is complete - ${
      remainingAttempts < 1 ? "reached max attempts" : "all goals processed"
    }`
  );
}

export async function processDischargeSummaryAssociation({
  dischargeData,
  cxId,
  patientId,
}: {
  dischargeData: DischargeData[];
  cxId: string;
  patientId: string;
}): Promise<{
  processing: DischargeAssociationProcessing[];
  completed: DischargeAssociationSuccess[];
}> {
  const { log } = out(`processDischargeSummaryAssociation - cx ${cxId}, pt ${patientId}`);
  log(`Checking goals: ${JSON.stringify(dischargeData)}`);

  const consolidated = await getConsolidatedFile({
    cxId,
    patientId,
  });

  if (!consolidated.bundle) {
    return {
      processing: dischargeData.map(discharge =>
        createProcessingDischargeAssociation(discharge, "No consolidated file found")
      ),
      completed: [],
    };
  }

  const bundle = consolidated.bundle;
  const encounters = findEncounterResources(bundle);
  const diagnosticReports = findDiagnosticReportResources(bundle);
  const documentReferences = findDocumentReferenceResources(bundle);
  const compositions = findCompositionResources(bundle);

  const matchingResults = dischargeData.map(discharge => {
    const matchingEncounter = getMatchingEncounter(encounters, discharge);

    if (!matchingEncounter) {
      log(`No matching encounter found for discharge date: ${discharge.encounterEndDate}`);
      const result = createProcessingDischargeAssociation(discharge, "No matching encounter found");
      analytics({
        event: EventTypes.dischargeDataProcessed,
        distinctId: cxId,
        properties: { status: result.status, reason: result.reason },
      });
      return result;
    }

    log(
      `Found matching encounter ${matchingEncounter.id} with ` +
        `start: ${matchingEncounter.period?.start}, end: ${matchingEncounter.period?.end}`
    );

    const encounterId = matchingEncounter.id;
    if (!encounterId) {
      const result = createProcessingDischargeAssociation(
        discharge,
        "Matching encounter has no ID"
      );
      analytics({
        event: EventTypes.dischargeDataProcessed,
        distinctId: cxId,
        properties: { status: result.status, reason: result.reason },
      });
      return result;
    }

    const scoredDocument = findDischargeSummaryDocument({
      diagnosticReportsOrDocumentReferences: [...diagnosticReports, ...documentReferences],
      compositions,
      encounter: matchingEncounter,
      dischargeDate: discharge.encounterEndDate,
    });

    const requeriesRemaining =
      discharge.dischargeRequeriesRemaining != null
        ? discharge.dischargeRequeriesRemaining - 1
        : defaultDischargeRequeryAttempts;

    if (!scoredDocument) {
      log(
        `No discharge summary document found for encounter ${matchingEncounter.id}. Looking for encounter with discharge disposition`
      );

      const encounterWithScore = getEncounterWithDischargeDisposition(encounters, discharge);
      const xmlFilePath = encounterWithScore
        ? getXmlFilePathFromExtensions(encounterWithScore.encounter.extension)
        : undefined;
      const encounterWithDischargeDispositionId = encounterWithScore?.encounter.id;

      if (xmlFilePath && encounterWithDischargeDispositionId) {
        const { encounter, score } = encounterWithScore;
        return scheduleRequeryOrCompleteIfNoRequeriesRemaining({
          discharge,
          score,
          document: encounter,
          requeriesRemaining,
          encounterId: encounterWithDischargeDispositionId,
          xmlFilePath,
          cxId,
        });
      }
      return scheduleRequeryOrFailIfNoRequeriesRemaining({
        discharge,
        reason: "No discharge summary document found",
        requeriesRemaining,
        cxId,
      });
    }

    const { document, score, xmlFilePath } = scoredDocument;

    log(
      `Found ${document.resourceType} ${document.id}, score: ${score}, xmlPath: ${xmlFilePath}, requeries: ${requeriesRemaining}`
    );

    return scheduleRequeryOrCompleteIfNoRequeriesRemaining({
      discharge,
      score,
      document,
      requeriesRemaining,
      encounterId,
      xmlFilePath,
      cxId,
    });
  });

  const processing: DischargeAssociationProcessing[] = [];
  const completed: DischargeAssociationSuccess[] = [];

  for (const result of matchingResults) {
    if (result.status === "processing") {
      processing.push(result);
    } else {
      completed.push(result);
    }
  }

  return { processing, completed };
}

/**
 * Finds an encounter matching the discharge date.
 */
function getMatchingEncounter(
  encounters: Encounter[],
  discharge: DischargeData
): Encounter | undefined {
  return encounters.find(e => e.period?.end === discharge.encounterEndDate && e.id);
}

/**
 * Gets the report timestamp from effectiveDateTime, effectivePeriod.start, or effectivePeriod.end.
 */
function getReportTimestamp(report: DiagnosticReport): Date | undefined {
  if (report.effectiveDateTime) {
    return new Date(report.effectiveDateTime);
  }
  if (report.effectivePeriod?.start) {
    return new Date(report.effectivePeriod.start);
  }
  if (report.effectivePeriod?.end) {
    return new Date(report.effectivePeriod.end);
  }
  return undefined;
}

/**
 * Checks if a DiagnosticReport timestamp is within the encounter time range.
 */
function isWithinTimeRange(
  report: DiagnosticReport | DocumentReference,
  start: Date,
  end: Date
): boolean {
  const timestamp =
    report.resourceType === "DiagnosticReport"
      ? getReportTimestamp(report)
      : getDocumentReferenceTimestamp(report);
  if (!timestamp) return false;
  return timestamp >= start && timestamp <= end;
}

/**
 * Decodes and returns the presentedForm text content from a DiagnosticReport.
 */
function getDecodedPresentedFormText(report: DiagnosticReport): string | undefined {
  const presentedForm = report.presentedForm;
  if (!presentedForm || presentedForm.length === 0) return undefined;

  const textContents: string[] = [];

  for (const attachment of presentedForm) {
    const base64Data = attachment.data;
    if (!base64Data) continue;

    const textContent = base64ToString(base64Data);
    if (textContent.trim()) {
      textContents.push(textContent);
    }
  }

  return textContents.length > 0 ? textContents.join("\n\n") : undefined;
}

/**
 * Checks if a Composition section contains a reference to the DiagnosticReport.
 */
function sectionContainsDiagReport(
  section: NonNullable<Composition["section"]>[number],
  report: DiagnosticReport
): boolean {
  const diagReportReference = `DiagnosticReport/${report.id}`;
  return section.entry?.some(entry => entry.reference === diagReportReference) ?? false;
}

/**
 * Gets the content bucket score based on discharge summary codes and search terms.
 * Checks DR codes and Composition section codes first, then falls back to text search.
 */
function getContentScore(
  report: DiagnosticReport,
  composition: Composition | undefined,
  text: string | undefined
): number {
  const drCodes = getCodes(report, composition);

  for (const { code: targetCode, bucket } of DISCHARGE_SUMMARY_CODES) {
    if (drCodes.includes(targetCode)) {
      return bucket;
    }
  }

  if (!text) return DISCHARGE_SUMMARY_SEARCH_TERM_NO_MATCH_VALUE;
  const lowerText = text.toLowerCase();
  for (const { term, bucket } of DISCHARGE_SUMMARY_SEARCH_TERMS) {
    if (lowerText.includes(term)) {
      return bucket;
    }
  }

  return DISCHARGE_SUMMARY_SEARCH_TERM_NO_MATCH_VALUE;
}

/**
 * Collects all codes from a DiagnosticReport and its associated Composition section.
 * The codes are later evaluated in getContentScore to determine relevance.
 */
function getCodes(report: DiagnosticReport, composition: Composition | undefined): string[] {
  const codes: string[] = [];

  for (const coding of report.code?.coding ?? []) {
    if (coding.code) codes.push(coding.code);
  }

  if (composition?.section) {
    for (const section of composition.section) {
      if (!sectionContainsDiagReport(section, report)) continue;
      for (const coding of section.code?.coding ?? []) {
        if (coding.code) codes.push(coding.code);
      }
    }
  }

  return codes;
}

/**
 * Gets the XML file path from a resource's doc-id extension.
 */
function getXmlFilePathFromExtensions(extensions: Extension[] | undefined): string | undefined {
  if (!extensions) return undefined;
  const docIdExtension = extensions
    .filter(isDocIdExtension)
    .find(ext => ext.valueString?.includes(`.${XML_FILE_EXTENSION}`));
  return docIdExtension?.valueString;
}

/**
 * Finds the Composition that has the same XML file as this DiagnosticReport.
 */
function findCompositionForDiagnosticReport(
  compositions: Composition[],
  report: DiagnosticReport
): Composition | undefined {
  const drXmlPath = getXmlFilePathFromExtensions(report.extension);
  if (!drXmlPath) return undefined;

  for (const composition of compositions) {
    const compXmlPath = getXmlFilePathFromExtensions(composition.extension);
    if (compXmlPath && compXmlPath === drXmlPath) {
      return composition;
    }
  }
  return undefined;
}

/**
 * Counts unique encounter references in the Composition.
 */
function countEncountersInComposition(composition: Composition): number {
  const encounterRefs = new Set<string>();

  if (composition.encounter?.reference) {
    encounterRefs.add(composition.encounter.reference.toLowerCase());
  }

  (composition.section ?? [])
    .flatMap(section => section.entry ?? [])
    .forEach(entry => {
      const ref = entry.reference;
      if (ref && (ref.startsWith("Encounter/") || ref.includes("/Encounter/"))) {
        encounterRefs.add(ref.toLowerCase());
      }
    });

  return encounterRefs.size || DEFAULT_NO_ENCOUNTERS_FOUND_VALUE;
}

/**
 * Gets the composition score based on encounter count. Less encounters = higher score.
 * Returns 0 if no match.
 */
function getCompositionScore(encounterCount: number): number {
  for (const { minEncounters, maxEncounters, bucket } of COMPOSITION_SCORES) {
    if (encounterCount >= minEncounters && encounterCount <= maxEncounters) {
      return bucket;
    }
  }
  return 0;
}

/**
 * Gets the temporal proximity score (0-2 range, closer to discharge = higher).
 */
function getTemporalScore(reportDate: Date, admitDate: Date, dischargeDate: Date): number {
  const encounterDuration = dischargeDate.getTime() - admitDate.getTime();
  if (encounterDuration <= 0) return HIGHEST_TEMPORAL_SCORE;

  const distanceFromDischarge = Math.abs(dischargeDate.getTime() - reportDate.getTime());
  const ratio = distanceFromDischarge / encounterDuration;
  // It's possible that the date on the report is after the discharge date.
  return HIGHEST_TEMPORAL_SCORE * Math.max(0, Math.min(1, 1 - ratio));
}

/**
 * Ranks a DiagnosticReport by adding up content, composition, and temporal scores.
 */
function rankDiagnosticReports({
  report,
  compositions,
  admitDate,
  dischargeDate,
}: {
  report: DiagnosticReport;
  compositions: Composition[];
  admitDate: Date;
  dischargeDate: Date;
}): ScoredDocument | undefined {
  const text = getDecodedPresentedFormText(report);
  const xmlFilePath = getXmlFilePathFromExtensions(report.extension);
  if (!xmlFilePath) return undefined;

  const composition = findCompositionForDiagnosticReport(compositions, report);

  const contentScore = getContentScore(report, composition, text);
  if (contentScore === DISCHARGE_SUMMARY_SEARCH_TERM_NO_MATCH_VALUE) return undefined;

  const encounterCount = composition
    ? countEncountersInComposition(composition)
    : DEFAULT_NO_ENCOUNTERS_FOUND_VALUE;
  const compositionScore = getCompositionScore(encounterCount);

  const reportDate = getReportTimestamp(report);
  const temporalScore = reportDate ? getTemporalScore(reportDate, admitDate, dischargeDate) : 0;

  const score = contentScore + compositionScore + temporalScore;
  return { document: report, score, xmlFilePath };
}

/**
 * Ranks a DocumentReference by checking if it has discharge instructions type/category codes.
 */
function rankDocumentReferences({
  documentReference,
  compositions,
  admitDate,
  dischargeDate,
}: {
  documentReference: DocumentReference;
  compositions: Composition[];
  admitDate: Date;
  dischargeDate: Date;
}): ScoredDocument | undefined {
  const xmlFilePath = getXmlFilePathFromContent(documentReference);
  if (!xmlFilePath) return undefined;

  const dischargeBucket = getDocumentReferenceCodeScore(documentReference);
  if (!dischargeBucket) return undefined;

  const docDate = getDocumentReferenceTimestamp(documentReference);

  const encounterCount = getEncounterCountForDocumentReference(documentReference, compositions);
  const compositionScore = getCompositionScore(encounterCount);

  const temporalScore = docDate ? getTemporalScore(docDate, admitDate, dischargeDate) : 0;

  const score = dischargeBucket + compositionScore + temporalScore;
  return { document: documentReference, score, xmlFilePath };
}

/**
 * Returns the bucket score if DocumentReference has discharge instructions LOINC codes in type or category.
 */
function getDocumentReferenceCodeScore(docRef: DocumentReference): number | undefined {
  const typeCodes = docRef.type?.coding?.map(c => c.code) ?? [];
  const categoryCodes = docRef.category?.flatMap(cat => cat.coding?.map(c => c.code) ?? []) ?? [];
  const allCodes = [...typeCodes, ...categoryCodes];

  const match = DOCUMENT_REFERENCE_DISCHARGE_CODES.find(({ code }) => allCodes.includes(code));
  return match?.bucket;
}

/**
 * Gets the timestamp from a DocumentReference, preferring context.period over date.
 * This is because date can be set after discharge (common for summaries), which could
 * exclude the document even when context.period matches the encounter.
 */
function getDocumentReferenceTimestamp(docRef: DocumentReference): Date | undefined {
  if (docRef.context?.period?.end) {
    return new Date(docRef.context.period.end);
  }
  if (docRef.context?.period?.start) {
    return new Date(docRef.context.period.start);
  }
  if (docRef.date) {
    return new Date(docRef.date);
  }
  return undefined;
}

/**
 * Finds the best DiagnosticReport that contains discharge summary content within the encounter time range.
 * Selects the report with the highest total score (content + number of encounters + proximity to discharge date).
 * TODO 1815: Get the admit date from the ADT not the encounter.
 */
function findDischargeSummaryDocument({
  diagnosticReportsOrDocumentReferences,
  compositions,
  encounter,
  dischargeDate,
}: {
  diagnosticReportsOrDocumentReferences: (DiagnosticReport | DocumentReference)[];
  compositions: Composition[];
  encounter: Encounter;
  dischargeDate: string;
}): ScoredDocument | undefined {
  const admitDate = encounter.period?.start;
  if (!admitDate) return undefined;

  const startDate = new Date(
    buildDayjs(admitDate).subtract(TIME_TO_ADD_TO_DISCHARGE_DATE).toDate()
  );
  const endDate = new Date(buildDayjs(dischargeDate).add(TIME_TO_ADD_TO_DISCHARGE_DATE).toDate());

  let bestMatch: ScoredDocument | undefined;
  for (const resource of diagnosticReportsOrDocumentReferences) {
    if (!isWithinTimeRange(resource, startDate, endDate)) continue;
    const scored =
      resource.resourceType === "DiagnosticReport"
        ? rankDiagnosticReports({
            report: resource,
            compositions,
            admitDate: new Date(admitDate),
            dischargeDate: new Date(dischargeDate),
          })
        : rankDocumentReferences({
            documentReference: resource,
            compositions,
            admitDate: new Date(admitDate),
            dischargeDate: new Date(dischargeDate),
          });
    const isBetterMatch = scored && (!bestMatch || scored.score > bestMatch.score);
    if (isBetterMatch) {
      bestMatch = scored;
    }
  }

  return bestMatch?.document
    ? { document: bestMatch.document, score: bestMatch.score, xmlFilePath: bestMatch.xmlFilePath }
    : undefined;
}

/**
 * Updates TCM encounters with discharge summary file paths for completed associations.
 */
async function updateTcmEncountersWithDischargeSummaryPaths(
  completedAssociations: DischargeAssociationSuccess[],
  cxId: string,
  patientId: string
): Promise<void> {
  const { log } = out(`updateTcmEncountersWithDischargeSummaryPaths - cx ${cxId}, pt ${patientId}`);

  if (completedAssociations.length < 1) {
    log("No completed associations to update");
    return;
  }

  const updatePromises = completedAssociations.map(async association => {
    const tcmEncounterId = association.discharge.tcmEncounterId;
    log(
      `Updating TCM encounter ${tcmEncounterId} with ` +
        `discharge summary path: ${association.dischargeSummaryFilePath}`
    );

    try {
      await updateTcmEncounter({
        id: tcmEncounterId,
        cxId,
        dischargeSummaryPath: association.dischargeSummaryFilePath,
      });
      log(`Successfully updated TCM encounter ${tcmEncounterId}`);
    } catch (error) {
      log(`Failed to update TCM encounter ${tcmEncounterId}: ${error}`);
      capture.message("Failed to update TCM encounter with discharge summary path", {
        extra: {
          tcmEncounterId: tcmEncounterId,
          cxId,
          patientId,
          encounterId: association.encounterId,
          dischargeSummaryPath: association.dischargeSummaryFilePath,
        },
        level: "error",
      });
    }
  });

  await Promise.all(updatePromises);
}

function createCompletedDischargeAssociation(
  discharge: DischargeData,
  reason: string,
  encounterId: string,
  dischargeSummaryFilePath: string
): DischargeAssociationSuccess {
  return {
    discharge,
    status: "completed",
    reason,
    encounterId,
    dischargeSummaryFilePath,
  };
}

function createProcessingDischargeAssociation(
  discharge: DischargeData,
  reason: string
): DischargeAssociationProcessing {
  return {
    discharge,
    status: "processing",
    reason,
  };
}

function createRequeryDischargeAssociation(
  discharge: DischargeData,
  reason: string,
  requeriesRemaining: number
): DischargeAssociationRequery {
  return {
    discharge: { ...discharge, dischargeRequeriesRemaining: requeriesRemaining },
    status: "processing",
    reason,
  };
}

function scheduleRequeryOrFailIfNoRequeriesRemaining({
  discharge,
  reason,
  requeriesRemaining,
  cxId,
}: {
  discharge: DischargeData;
  reason: string;
  requeriesRemaining: number;
  cxId: string;
}): DischargeAssociationProcessing | DischargeAssociationRequery {
  if (requeriesRemaining < 1) {
    const result = createProcessingDischargeAssociation(discharge, reason);
    analytics({
      event: EventTypes.dischargeDataProcessed,
      distinctId: cxId,
      properties: { status: result.status, reason: result.reason },
    });
    return result;
  }

  const result = createRequeryDischargeAssociation(discharge, reason, requeriesRemaining);
  analytics({
    event: EventTypes.dischargeDataProcessed,
    distinctId: cxId,
    properties: { status: result.status, reason: result.reason },
  });
  return result;
}

function scheduleRequeryOrCompleteIfNoRequeriesRemaining({
  discharge,
  score,
  document,
  requeriesRemaining,
  encounterId,
  xmlFilePath,
  cxId,
}: {
  discharge: DischargeData;
  score: number;
  document: DiagnosticReport | DocumentReference | Encounter;
  requeriesRemaining: number;
  encounterId: string;
  xmlFilePath: string;
  cxId: string;
}): DischargeAssociationSuccess | DischargeAssociationProcessing {
  if (score >= DISCHARGE_SUMMARY_SCORE_THRESHOLD || requeriesRemaining < 1) {
    const result = createCompletedDischargeAssociation(
      discharge,
      `Found discharge summary in ${document.resourceType}`,
      encounterId,
      xmlFilePath
    );
    analytics({
      event: EventTypes.dischargeDataProcessed,
      distinctId: cxId,
      properties: { status: result.status, reason: result.reason, score },
    });
    return result;
  }

  const result = createRequeryDischargeAssociation(
    discharge,
    "Found discharge summary, requerying for better match",
    requeriesRemaining
  );
  analytics({
    event: EventTypes.dischargeDataProcessed,
    distinctId: cxId,
    properties: { status: result.status, reason: result.reason, score },
  });
  return result;
}

function getEncounterWithDischargeDisposition(
  encounters: Encounter[],
  discharge: DischargeData
): { encounter: Encounter; score: number } | undefined {
  const encounter = encounters.find(
    e =>
      e.hospitalization?.dischargeDisposition?.coding?.some(
        coding => coding.system === DISCHARGE_DISPOSITION_SYSTEM
      ) &&
      e.period?.end === discharge.encounterEndDate &&
      // Filter out ADT encounters by requiring an XML file path (ADT encounters have HL7 paths)
      getXmlFilePathFromExtensions(e.extension)
  );
  if (!encounter) return undefined;
  return { encounter, score: DISCHARGE_DISPOSITION_SCORE };
}

function getEncounterCountForDocumentReference(
  docRef: DocumentReference,
  compositions: Composition[]
): number {
  const composition = findCompositionForDocumentReference(compositions, docRef);
  return composition
    ? countEncountersInComposition(composition)
    : DEFAULT_NO_ENCOUNTERS_FOUND_VALUE;
}

function findCompositionForDocumentReference(
  compositions: Composition[],
  docRef: DocumentReference
): Composition | undefined {
  const xmlPath = getXmlFilePathFromContent(docRef);
  if (!xmlPath) return undefined;

  const composition = compositions.find(
    composition => getXmlFilePathFromExtensions(composition.extension) === xmlPath
  );
  return composition;
}

function getXmlFilePathFromContent(docRef: DocumentReference): string | undefined {
  const xmlContent = docRef.content?.find(content =>
    content.attachment?.title?.includes(XML_FILE_EXTENSION)
  );
  return xmlContent?.attachment?.title;
}
