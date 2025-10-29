import { Encounter } from "@medplum/fhirtypes";
import { getConsolidatedFile } from "@metriport/core/command/consolidated/consolidated-get";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { isDocIdExtension } from "@metriport/core/external/fhir/shared/extensions/doc-id-extension";
import { findEncounterResources } from "@metriport/core/external/fhir/shared/index";
import { capture } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import { XML_FILE_EXTENSION } from "@metriport/core/util/mime";
import { JobEntryStatus } from "@metriport/shared/domain/job/types";
import {
  DischargeData,
  dischargeRequeryRuntimeDataSchema,
  parseDischargeRequeryJob,
} from "@metriport/shared/domain/patient/patient-monitoring/discharge-requery";
import { getPatientJobs } from "../../../../job/patient/get";
import { completePatientJob } from "../../../../job/patient/status/complete";
import { failPatientJob } from "../../../../job/patient/status/fail";
import { updatePatientJobRuntimeData } from "../../../../job/patient/update/update-runtime-data";
import { updateTcmEncounter } from "../../../tcm-encounter/update-tcm-encounter";
import { getPatientOrFail } from "../../get-patient";
import { createDischargeRequeryJob, dischargeRequeryJobType } from "./create";
import { sendNotificationToSlack } from "./shared";

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
          reason: "Unexpected number of processingdischarge requery jobs",
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
      processing: dischargeData.map(discharge => ({
        discharge,
        status: "processing" as const,
        reason: "No consolidated file found",
      })),
      completed: [],
    };
  }

  const encounters = findEncounterResources(consolidated.bundle);
  const matchingResults = await Promise.all(
    dischargeData.map(async discharge => {
      const matchingEncounters = getMatchingEncountersWithSummaryPath(encounters, discharge);

      let result: DischargeAssociationProcessing | DischargeAssociationSuccess;
      if (matchingEncounters.length < 1) {
        result = {
          discharge,
          status: "processing",
          reason: "No matching encounters found",
        };
      } else if (matchingEncounters.length === 1) {
        result = {
          discharge,
          status: "completed",
          reason: "Found a discharge encounter",
          encounterId: matchingEncounters[0].id,
          dischargeSummaryFilePath: matchingEncounters[0].dischargeSummaryFilePath,
        };
      } else {
        const matchingEncounterWithDisposition = matchingEncounters.find(
          e => !!e.encounter.hospitalization?.dischargeDisposition
        );

        const matchingEncounter = matchingEncounterWithDisposition ?? matchingEncounters[0];

        const msg = "Multiple discharge encounter matches found";
        await sendNotificationToSlack(
          msg,
          JSON.stringify(
            { patientId, cxId, discharge, numberOfMatches: matchingEncounters.length },
            null,
            2
          )
        );
        result = {
          discharge,
          status: "completed",
          reason: msg,
          encounterId: matchingEncounter.id,
          dischargeSummaryFilePath: matchingEncounter.dischargeSummaryFilePath,
        };
      }

      analytics({
        event: EventTypes.dischargeDataProcessed,
        distinctId: cxId,
        properties: { status: result.status, reason: result.reason },
      });

      return result;
    })
  );

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

type MatchingEncounter = {
  id: string;
  encounter: Encounter;
  dischargeSummaryFilePath: string;
};

export function getMatchingEncountersWithSummaryPath(
  encounters: Encounter[],
  discharge: DischargeData
): MatchingEncounter[] {
  return encounters
    .filter(
      e =>
        e.period?.end === discharge.encounterEndDate &&
        e.extension
          ?.filter(isDocIdExtension)
          ?.some(e => e.valueString?.includes(`.${XML_FILE_EXTENSION}`))
    )
    .flatMap(encounter => {
      const dischargeSummaryFilePath = encounter.extension
        ?.filter(isDocIdExtension)
        ?.find(e => e.valueString?.includes(`.${XML_FILE_EXTENSION}`))?.valueString;

      if (!dischargeSummaryFilePath || !encounter.id) return [];

      return {
        id: encounter.id,
        dischargeSummaryFilePath,
        encounter,
      };
    });
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

  // Update TCM encounters with discharge summary file paths
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
