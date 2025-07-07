import { getConsolidatedFile } from "@metriport/core/command/consolidated/consolidated-get";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { findEncounterResources } from "@metriport/core/external/fhir/shared";
import { isDocIdExtension } from "@metriport/core/external/fhir/shared/extensions/doc-id-extension";
import { sendToSlack, SlackMessage } from "@metriport/core/external/slack/index";
import { capture } from "@metriport/core/util";
import { Config } from "@metriport/core/util/config";
import { out } from "@metriport/core/util/log";
import { JobEntryStatus } from "@metriport/shared/domain/job/types";
import {
  DischargeRequeryGoal,
  DischargeRequeryGoals,
  dischargeRequeryRuntimeDataSchema,
  parseDischargeRequeryJob,
} from "@metriport/shared/domain/patient/patient-monitoring/discharge-requery";
import { getPatientJobs } from "../../../../job/patient/get";
import { completePatientJob } from "../../../../job/patient/status/complete";
import { failPatientJob } from "../../../../job/patient/status/fail";
import { updatePatientJobRuntimeData } from "../../../../job/patient/update/update-runtime-data";
import { getPatientOrFail } from "../../get-patient";
import { createDischargeRequeryJob, dischargeRequeryJobType } from "./create";

type GoalBreakdown = {
  goal: DischargeRequeryGoal;
  status: "met" | "unmet" | "failed";
  dischargeSummaryFilePath?: string;
  reason?: string;
  encounterIds?: string[];
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
 * @param status - The status of the data pipeline query.
 */
export async function finishDischargeRequery({
  cxId,
  patientId,
  requestId: dataPipelineRequestId,
  status,
}: {
  cxId: string;
  patientId: string;
  requestId: string;
  status: JobEntryStatus;
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
    return runtimeData?.documentQueryRequestId === dataPipelineRequestId;
  });

  if (targetJobs.length < 1) {
    const msg = `No target discharge requery job found`;
    log(`Unexpected state: ${msg} for requestId ${dataPipelineRequestId}`);
    capture.message(msg, {
      extra: {
        patientId,
        cxId,
        dataPipelineRequestId,
      },
    });
    return;
  }

  const [targetJob, ...jobsToFail] = targetJobs;

  if (jobsToFail.length > 0) {
    const msg = `Found an unexpected number of discharge requery jobs`;
    log(`${msg} for requestId ${dataPipelineRequestId}, expected 1, found ${targetJobs.length}`);
    capture.message(msg, {
      extra: {
        patientId,
        cxId,
        jobType: dischargeRequeryJobType,
        dataPipelineRequestId,
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

  const goalsBreakdown = await checkGoals(dischargeRequeryJob.paramsOps.goals, cxId, patientId);

  const remainingAttempts =
    status === "successful"
      ? dischargeRequeryJob.paramsOps.remainingAttempts - 1
      : dischargeRequeryJob.paramsOps.remainingAttempts;

  if (status === "successful") {
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
          metGoals: goalsBreakdown.metGoals,
          failedGoals: goalsBreakdown.failedGoals,
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

  if (remainingAttempts > 0 && goalsBreakdown.unmetGoals.length > 0) {
    await createDischargeRequeryJob({
      patientId,
      cxId,
      remainingAttempts,
      goals: goalsBreakdown.unmetGoals.map(u => u.goal),
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

export async function checkGoals(
  goals: DischargeRequeryGoals,
  cxId: string,
  patientId: string
): Promise<{
  unmetGoals: GoalBreakdown[];
  failedGoals: GoalBreakdown[];
  metGoals: GoalBreakdown[];
}> {
  const { log } = out(`checkGoals - cx ${cxId}, pt ${patientId}`);
  log(`Checking goals: ${JSON.stringify(goals)}`);

  const unmetGoals: GoalBreakdown[] = [];
  const failedGoals: GoalBreakdown[] = [];
  const metGoals: GoalBreakdown[] = [];

  const consolidated = await getConsolidatedFile({
    cxId,
    patientId,
  });

  if (!consolidated.bundle) {
    unmetGoals.push(
      ...goals.map(goal => ({
        goal,
        status: "unmet" as const,
        reason: "No consolidated file found",
      }))
    );
    return { unmetGoals, failedGoals, metGoals };
  }

  const encounters = findEncounterResources(consolidated.bundle);
  await Promise.all(
    goals.map(async goal => {
      const matchingEncounters = encounters.filter(e => e.period?.end === goal.encounterEndDate);

      if (matchingEncounters.length === 0) {
        unmetGoals.push({ goal, status: "unmet", reason: "No matching encounters found" });
        return;
      }

      if (matchingEncounters.length > 1) {
        const channelUrl = Config.getDischargeNotificationSlackUrl();
        const encounterIds = matchingEncounters.flatMap(e => e.id ?? []);

        const msg = "Multiple encounters found for the same date";
        log(`${msg} for encounters: ${JSON.stringify(encounterIds)}`);
        const message: SlackMessage = {
          subject: msg,
          message: JSON.stringify(encounterIds, null, 2),
          emoji: ":peepo_hey:",
        };

        await sendToSlack(message, channelUrl);

        failedGoals.push({
          goal,
          status: "failed",
          reason: msg,
          encounterIds,
        });
        return;
      }

      const dischargeEncounter = matchingEncounters[0];
      const dischargeSummaryFilePath =
        dischargeEncounter.meta?.source ??
        dischargeEncounter.extension?.find(isDocIdExtension)?.valueString;

      if (!dischargeSummaryFilePath) {
        const msg = "Encounter resource missing source";
        log(msg);
        capture.message(msg, {
          extra: {
            cxId,
            patientId,
            encounterId: dischargeEncounter.id,
          },
          level: "warning",
        });

        failedGoals.push({ goal, status: "failed", reason: msg });
        return;
      }

      const successReason = dischargeEncounter.hospitalization?.dischargeDisposition
        ? "Discharge disposition found in encounter"
        : "Matching encounter datetime";

      metGoals.push({
        goal,
        status: "met",
        dischargeSummaryFilePath,
        reason: successReason,
      });
    })
  );

  return { unmetGoals, failedGoals, metGoals };
}
