import { Encounter } from "@medplum/fhirtypes";
import { getConsolidatedFile } from "@metriport/core/command/consolidated/consolidated-get";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { isDocIdExtension } from "@metriport/core/external/fhir/shared/extensions/doc-id-extension";
import { findEncounterResources } from "@metriport/core/external/fhir/shared/index";
import { capture } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import { JobEntryStatus } from "@metriport/shared/domain/job/types";
import {
  DischargeData,
  dischargeRequeryRuntimeDataSchema,
  parseDischargeRequeryJob,
} from "@metriport/shared/domain/patient/patient-monitoring/discharge-requery";
import _ from "lodash";
import { getPatientJobs } from "../../../../job/patient/get";
import { completePatientJob } from "../../../../job/patient/status/complete";
import { failPatientJob } from "../../../../job/patient/status/fail";
import { updatePatientJobRuntimeData } from "../../../../job/patient/update/update-runtime-data";
import { getPatientOrFail } from "../../get-patient";
import { createDischargeRequeryJob, dischargeRequeryJobType } from "./create";
import { sendNotificationToSlack } from "./shared";

type DischargeAssociationBreakdown = {
  discharge: DischargeData;
  status: "processing" | "completed" | "failed";
  reason?: string;
  encounterId?: string;
  dischargeSummaryFilePath?: string;
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

  if (processingJobs.length === 0) {
    return;
  }

  const targetJobs = processingJobs.filter(job => {
    const runtimeData = dischargeRequeryRuntimeDataSchema.parse(job.runtimeData);
    return runtimeData?.documentQueryRequestId === pipelineRequestId;
  });

  if (targetJobs.length < 1) {
    const msg = `No target discharge requery job found`;
    log(`Unexpected state: ${msg} for requestId ${pipelineRequestId}`);
    capture.message(msg, {
      extra: {
        cxId,
        patientId,
        pipelineRequestId,
      },
    });
    return;
  }

  const [targetJob, ...jobsToFail] = targetJobs;

  if (jobsToFail.length > 0) {
    const msg = `Found an unexpected number of discharge requery jobs`;
    log(`${msg} for requestId ${pipelineRequestId}, expected 1, found ${targetJobs.length}`);
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

  const associationBreakdown = await processDischargeSummaryAssociation(
    dischargeRequeryJob.paramsOps.dischargeData,
    cxId,
    patientId
  );

  const remainingAttempts =
    pipelineStatus === "successful"
      ? dischargeRequeryJob.paramsOps.remainingAttempts - 1
      : dischargeRequeryJob.paramsOps.remainingAttempts;

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
          metGoals: associationBreakdown.completed,
          failedGoals: associationBreakdown.failed,
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

  if (remainingAttempts > 0 && associationBreakdown.processing.length > 0) {
    await createDischargeRequeryJob({
      patientId,
      cxId,
      remainingAttempts,
      dischargeData: associationBreakdown.processing.map(p => p.discharge),
    });
    log(`Created a new discharge requery job with ${remainingAttempts} remaining attempts`);
    return;
  }

  log(
    `Discharge requery is complete - ${
      remainingAttempts < 1 ? "reached max attempts" : "all goals met"
    }`
  );
}

async function processDischargeSummaryAssociation(
  dischargeData: DischargeData[],
  cxId: string,
  patientId: string
): Promise<{
  processing: DischargeAssociationBreakdown[];
  completed: DischargeAssociationBreakdown[];
  failed: DischargeAssociationBreakdown[];
}> {
  const { log } = out(`checkGoals - cx ${cxId}, pt ${patientId}`);
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
      failed: [],
      completed: [],
    };
  }

  const encounters = findEncounterResources(consolidated.bundle);
  const matchingResults = await Promise.all(
    dischargeData.map(async discharge => {
      const matchingEncounters = getPotentiallyMatchingEncounters(encounters, discharge);
      const matchingResult = await findMatchingEncounterOrNotifyOfFailure(matchingEncounters, cxId);

      return {
        ...matchingResult,
        discharge,
      };
    })
  );

  const groupedByStatus = _.groupBy(matchingResults, "status");

  return {
    processing: groupedByStatus.processing ?? [],
    failed: groupedByStatus.failed ?? [],
    completed: groupedByStatus.completed ?? [],
  };
}

function getPotentiallyMatchingEncounters(encounters: Encounter[], discharge: DischargeData) {
  return encounters.filter(e => e.period?.end === discharge.encounterEndDate);
}

export async function findMatchingEncounterOrNotifyOfFailure(
  encounters: Encounter[],
  cxId: string
): Promise<Omit<DischargeAssociationBreakdown, "discharge">> {
  const { status, reason, encounter, sendNotification } =
    getDischargeSummaryStatusAndFilePath(encounters);

  if (sendNotification) {
    const encounterIds = encounters.flatMap(e => e.id ?? []);
    await sendNotificationToSlack(reason, encounterIds);
  }

  analytics({
    event: EventTypes.dischargeDataProcessed,
    distinctId: cxId,
    properties: { status, reason },
  });

  if (encounter) {
    const filePath =
      encounter.meta?.source ?? encounter.extension?.find(isDocIdExtension)?.valueString;

    return {
      status,
      reason,
      dischargeSummaryFilePath: filePath,
      encounterId: encounter.id,
    };
  }

  return {
    status,
    reason,
  };
}

function getDischargeSummaryStatusAndFilePath(encounters: Encounter[]): {
  status: "processing" | "completed" | "failed";
  reason: string;
  encounter: Encounter | undefined;
  sendNotification: boolean;
} {
  if (encounters.length === 0) {
    return {
      status: "processing",
      reason: "No matching encounters found",
      encounter: undefined,
      sendNotification: false,
    };
  }

  const encountersWithDischargeDisposition = encounters.filter(
    e => e.hospitalization?.dischargeDisposition
  );

  if (encountersWithDischargeDisposition.length > 1) {
    return {
      status: "failed",
      reason: "Multiple discharge encounters found for the same date",
      encounter: undefined,
      sendNotification: true,
    };
  }

  if (encountersWithDischargeDisposition.length > 0) {
    return {
      status: "completed",
      reason: "Found a discharge disposition encounter",
      encounter: encountersWithDischargeDisposition[0],
      sendNotification: false,
    };
  }

  const encountersWithoutDischargeDisposition = encounters.filter(
    e => !e.hospitalization?.dischargeDisposition
  );

  if (encountersWithoutDischargeDisposition.length > 1) {
    return {
      status: "failed",
      reason: "Multiple encounters found for the same date",
      encounter: undefined,
      sendNotification: true,
    };
  }

  return {
    status: "completed",
    reason: "Matching encounter datetime",
    encounter: encountersWithoutDischargeDisposition[0],
    sendNotification: false,
  };
}
